import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { publicKey } from '@metaplex-foundation/umi'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { myoapp } from '../../lib/client'

const TOKEN_PROGRAM = new Web3PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM = new Web3PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

function u8aFromIdDecimal(id: string): Uint8Array {
  const hex = BigInt(id).toString(16).padStart(64, '0')
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

task('lz:oapp:solana:onft-diagnose', 'Diagnostics: check registry, escrow ATA, balances for id')
  .addParam('eid', 'Solana EndpointId', undefined, types.int)
  .addParam('id', 'ERC-1155 token id (decimal string)')
  .addParam('to', 'Receiver address (Solana base58)')
  .setAction(async ({ eid, id, to }: { eid: number; id: string; to: string }, _hre: HardhatRuntimeEnvironment) => {
    const { connection, umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)

    const client = new myoapp.RoninNftBridge(programId)
    const onftPda = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT')], toWeb3JsPublicKey(programId))[0]
    const toPk = new Web3PublicKey(to)

    // Fetch OnftConfig (to get token program). If account is missing - use standard Token Program
    let tokenProgram = TOKEN_PROGRAM
    try {
      const onftAcc = await myoapp.accounts.fetchOnftConfig(umi, publicKey(onftPda))
      if (onftAcc && (onftAcc as any).data?.tokenProgram) {
        tokenProgram = toWeb3JsPublicKey((onftAcc as any).data.tokenProgram)
      }
    } catch (_) {
      // fallback: TOKEN_PROGRAM
    }

    // Derive registry entry PDA and fetch it
    const id32 = u8aFromIdDecimal(id)
    const registryPda = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT_REG')], toWeb3JsPublicKey(programId))[0]
    const entryPda = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT_REG_ENTRY'), Buffer.from(id32)], toWeb3JsPublicKey(programId))[0]
    const entryInfo = await connection.getAccountInfo(entryPda)
    if (!entryInfo) {
      console.log('❌ Registry entry not found:', entryPda.toBase58())
      return
    }
    // Parse entry (new model):
    // [8 discriminator][32 id32][32 mint][32 pending_to][8 pending_amount][1 pending][1 bump]
    const data = entryInfo.data
    const mintPk = new Web3PublicKey(data.slice(8 + 32, 8 + 32 + 32))
    const pendingTo = new Web3PublicKey(data.slice(8 + 32 + 32, 8 + 32 + 32 + 32))
    const pendingAmount = Number(data.readBigUInt64LE(8 + 32 + 32 + 32))
    const pendingFlag = data[8 + 32 + 32 + 32 + 8] === 1

    // Derive escrow ATA (owner = OnftConfig PDA)
    const escrowAta = await getAssociatedTokenAddress(mintPk, onftPda, true, tokenProgram, ATA_PROGRAM)
    const destAta = await getAssociatedTokenAddress(mintPk, toPk, false, tokenProgram, ATA_PROGRAM)

    const escrowInfo = await connection.getTokenAccountBalance(escrowAta).catch(() => null)
    const destInfo = await connection.getTokenAccountBalance(destAta).catch(() => null)
    // Read store diagnostics string
    const storeAcc = await client.getStore(umi.rpc).catch(() => null as any)

    console.log('— Program ID:', deployment.programId)
    const storePda = client.pda.oapp()[0]
    console.log('— Store PDA:', storePda)
    try {
      const storeLamports = await connection.getBalance(toWeb3JsPublicKey(storePda))
      console.log('— Store balance (lamports):', storeLamports)
    } catch (_) {
      // ignore
    }
    console.log('— OnftConfig PDA:', onftPda.toBase58())
    console.log('— Registry PDA:', registryPda.toBase58())
    console.log('— Registry Entry PDA:', entryPda.toBase58())
    console.log('— Mint (from registry):', mintPk.toBase58())
    console.log('— Escrow ATA:', escrowAta.toBase58(), 'balance:', escrowInfo?.value?.uiAmountString ?? 'N/A')
    console.log('— Dest ATA:', destAta.toBase58(), 'exists:', destInfo != null, 'balance:', destInfo?.value?.uiAmountString ?? 'N/A')
    if (storeAcc && (storeAcc as any).string) {
      console.log('— Store.string:', (storeAcc as any).string)
    }

    // Pending (from registry entry)
    if (pendingFlag) {
      console.log('— Pending (entry):', 'to:', pendingTo.toBase58(), 'amount:', pendingAmount)
    } else {
      console.log('— Pending (entry): none')
    }

    if (!escrowInfo || Number(escrowInfo.value.amount) === 0) {
      console.log('⚠️  Escrow empty or does not exist for specified mint. Transfer tokens to escrow before receiving.')
    } else {
      console.log('✅ Escrow contains tokens. Reception error is not related to escrow balance.')
    }
  })


