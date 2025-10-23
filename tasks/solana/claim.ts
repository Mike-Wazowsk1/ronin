import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'
import { publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import fs from 'node:fs'
import bs58 from 'bs58'

import { myoapp } from '../../lib/client'
import { deriveConnection, getSolanaDeployment } from './index'

const TOKEN_PROGRAM = new Web3PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM = new Web3PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

const REG_ENTRY_SEED = Buffer.from('ONFT_REG_ENTRY')
const ONFT_SEED = Buffer.from('ONFT')

function idToBytes32(id: string): Uint8Array {
  const n = BigInt(id)
  const out = Buffer.alloc(32)
  out.writeBigUInt64BE((n >> 192n) & ((1n << 64n) - 1n), 0)
  out.writeBigUInt64BE((n >> 128n) & ((1n << 64n) - 1n), 8)
  out.writeBigUInt64BE((n >> 64n) & ((1n << 64n) - 1n), 16)
  out.writeBigUInt64BE(n & ((1n << 64n) - 1n), 24)
  return out
}

task('lz:oapp:solana:claim', 'Забирает NFT из эскроу по id, читая pending из OnftRegistryEntry')
  .addParam('eid', 'Solana EndpointId', undefined, types.int)
  .addParam('id', 'ERC-1155 token id (decimal string)')
  .addParam('to', 'Destination owner (base58)')
  .setAction(async ({ eid, id, to }: { eid: number; id: string; to: string }, hre: HardhatRuntimeEnvironment) => {
    // If SOLANA_MINT_AUTHORITY is provided, override signer for this task
    const mintAuth = process.env.SOLANA_MINT_AUTHORITY?.trim()
    if (mintAuth && mintAuth.length > 0) {
      const privFromEnv = process.env.SOLANA_MINT_AUTHORITY_PRIVATE_KEY?.trim()
      const pathFromEnv = process.env.SOLANA_MINT_AUTHORITY_KEYPAIR_PATH?.trim()
      const isJson = mintAuth.startsWith('[') || mintAuth.startsWith('{')
      const isExistingPath = fs.existsSync(mintAuth)
      const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintAuth)

      if (isJson) {
        process.env.SOLANA_PRIVATE_KEY = mintAuth
        delete process.env.SOLANA_KEYPAIR_PATH
      } else if (isExistingPath) {
        process.env.SOLANA_KEYPAIR_PATH = mintAuth
        delete process.env.SOLANA_PRIVATE_KEY
      } else if (isBase58) {
        if (privFromEnv) {
          process.env.SOLANA_PRIVATE_KEY = privFromEnv
          delete process.env.SOLANA_KEYPAIR_PATH
        } else if (pathFromEnv) {
          process.env.SOLANA_KEYPAIR_PATH = pathFromEnv
          delete process.env.SOLANA_PRIVATE_KEY
        } else {
          
          const bytes = Array.from(bs58.decode(mintAuth))
          process.env.SOLANA_PRIVATE_KEY = JSON.stringify(bytes)
          delete process.env.SOLANA_KEYPAIR_PATH
        }
      } else {
        
        try {
          const bytes = Array.from(bs58.decode(mintAuth))
          process.env.SOLANA_PRIVATE_KEY = JSON.stringify(bytes)
          delete process.env.SOLANA_KEYPAIR_PATH
        } catch (_) {
          
          process.env.SOLANA_KEYPAIR_PATH = mintAuth
          delete process.env.SOLANA_PRIVATE_KEY
        }
      }
    }

    const { umi, connection } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)
    const programIdW = toWeb3JsPublicKey(programId)

    const id32 = idToBytes32(id)
    const [registryEntry] = Web3PublicKey.findProgramAddressSync([REG_ENTRY_SEED, Buffer.from(id32)], programIdW)
    const entryInfo = await connection.getAccountInfo(registryEntry)
    if (!entryInfo) throw new Error('registry_entry not found. Did you run set-registry-entry?')
    const data = entryInfo.data
    // [8 discriminator][32 id32][32 mint][32 pending_to][8 pending_amount][1 pending][1 bump]
    if (data.length < 8 + 32 + 32 + 32 + 8 + 1 + 1) throw new Error('registry_entry too small')
    const mintPk = new Web3PublicKey(data.slice(8 + 32, 8 + 32 + 32))
    const pendingTo = new Web3PublicKey(data.slice(8 + 32 + 32, 8 + 32 + 32 + 32))
    const pendingAmount = Number(data.readBigUInt64LE(8 + 32 + 32 + 32))
    const pendingFlag = data[8 + 32 + 32 + 32 + 8] === 1

    const [onftSigner] = Web3PublicKey.findProgramAddressSync([ONFT_SEED], programIdW)
    const toOwner = new Web3PublicKey(to)
    let toAta = await getAssociatedTokenAddress(mintPk, toOwner, false, TOKEN_PROGRAM, ATA_PROGRAM)

    // Read OnftConfig to get canonical token program and escrow address
    const onftConfigInfo = await connection.getAccountInfo(onftSigner)
    if (!onftConfigInfo) throw new Error('onft_config not found')
    // OnftConfig layout: [8 discriminator][32 admin][32 token_mint][32 token_program][32 escrow][1 bump]
    if (onftConfigInfo.data.length < 8 + 32 + 32 + 32 + 32 + 1) throw new Error('onft_config too small')
    const tokenProgramPk = new Web3PublicKey(onftConfigInfo.data.slice(8 + 32 + 32, 8 + 32 + 32 + 32))
    // Derive escrow and dest using tokenProgram from config to avoid mismatch
    const escrowAta = await getAssociatedTokenAddress(mintPk, onftSigner, true, tokenProgramPk, ATA_PROGRAM)
    toAta = await getAssociatedTokenAddress(mintPk, toOwner, false, tokenProgramPk, ATA_PROGRAM)

    // Validate pending in registry entry
    if (!pendingFlag) throw new Error('no pending claim in entry')
    if (!pendingTo.equals(toOwner)) throw new Error('entry.pending_to mismatch with --to')

    const client = new myoapp.RoninNftBridge(programId)
    const ix = client.claim(
      {
        signer: umi.identity,
        store: publicKey(deployment.oapp),
        registry: publicKey(Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT_REG')], programIdW)[0].toBase58()),
        entry: publicKey(registryEntry.toBase58()),
        mint: publicKey(mintPk.toBase58()),
        onftConfig: publicKey(onftSigner.toBase58()),
        escrow: publicKey(escrowAta.toBase58()),
        dest: publicKey(toAta.toBase58()),
        tokenProgram: publicKey(tokenProgramPk.toBase58()),
        associatedTokenProgram: publicKey(ATA_PROGRAM.toBase58()),
        systemProgram: publicKey('11111111111111111111111111111111'),
      },
      { id32: Array.from(id32) as any }
    )

    const res = await transactionBuilder().add(ix).sendAndConfirm(umi)
    console.log('✅ claim sent, sig:', res.signature)
  })


