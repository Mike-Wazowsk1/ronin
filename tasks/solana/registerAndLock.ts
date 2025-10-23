import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { PublicKey as Web3PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token'
import { publicKey } from '@metaplex-foundation/umi'
import { deriveConnection, getSolanaDeployment, useWeb3Js } from '../solana'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { existsSync, readFileSync } from 'node:fs'
import bs58 from 'bs58'
import { myoapp } from '../../lib/client'

const TOKEN_PROGRAM = new Web3PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ATA_PROGRAM = new Web3PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

function loadAuthorityFromEnv() {
  const envJson = process.env.SOLANA_MINT_AUTHORITY
  const envPath = process.env.SOLANA_MINT_AUTHORITY_PATH
  if (envJson && envJson.trim().length > 0) {
    try {
      const arr = JSON.parse(envJson) as number[]
      return Uint8Array.from(arr)
    } catch {
      try {
        const decoded = bs58.decode(envJson)
        return Uint8Array.from(decoded)
      } catch {}
      if (existsSync(envJson)) {
        const raw = readFileSync(envJson, 'utf8')
        const arr = JSON.parse(raw) as number[]
        return Uint8Array.from(arr)
      }
      throw new Error('SOLANA_MINT_AUTHORITY must be JSON/bs58 key or path to file')
    }
  }
  if (envPath && existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8')
    const arr = JSON.parse(raw) as number[]
    return Uint8Array.from(arr)
  }
  return undefined
}

task('lz:oapp:solana:register-and-lock', 'Add id→mint entry and transfer token(s) to escrow')
  .addParam('eid', 'Solana EndpointId', undefined, types.int)
  .addParam('id', 'ERC-1155 token id (decimal string)')
  .addParam('mint', 'SPL mint (base58)')
  .addOptionalParam('amount', 'Number of tokens to lock', 1, types.int)
  .setAction(async ({ eid, id, mint, amount }: { eid: number; id: string; mint: string; amount?: number }, hre: HardhatRuntimeEnvironment) => {
    // 1) Add/update entry in registry
    try {
      await hre.run('lz:oapp:solana:set-registry-entry', { eid, id, mint })
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (/already in use|already initialized|already exists/i.test(msg)) {
        console.log(`ℹ️  registry entry id=${id} already exists, skipping set-registry-entry`)
      } else {
        console.warn(`⚠️  set-registry-entry failed: ${msg}`)
      }
    }

    // 2) Transfer amount to escrow (OnftConfig PDA)
    const { connection, umi } = await deriveConnection(eid as any, false)
    const { web3JsKeypair } = await useWeb3Js()
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)

    const onftPda = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT')], toWeb3JsPublicKey(programId))[0]
    const mintPk = new Web3PublicKey(mint)
    const payerPk = toWeb3JsPublicKey(umi.identity.publicKey)

    // Token owner (authority) may differ from payer; take from ENV, otherwise use default signer
    let sourceSecret = loadAuthorityFromEnv()
    let sourceSigner = web3JsKeypair
    if (sourceSecret) {
      // web3js Keypair.fromSecretKey
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Keypair } = require('@solana/web3.js')
      sourceSigner = Keypair.fromSecretKey(sourceSecret)
      console.log(`info:    Using source owner from ENV => ${sourceSigner.publicKey.toBase58()}`)
    } else {
      console.log(`info:    Using default signer as source owner => ${sourceSigner.publicKey.toBase58()}`)
    }

    const sourcePk = sourceSigner.publicKey
    const sourceAta = await getAssociatedTokenAddress(mintPk, sourcePk, false, TOKEN_PROGRAM, ATA_PROGRAM)
    const escrowAta = await getAssociatedTokenAddress(mintPk, onftPda, true, TOKEN_PROGRAM, ATA_PROGRAM)

    const ixs: any[] = []
    const sourceInfo = await connection.getAccountInfo(sourceAta)
    if (!sourceInfo) {
      ixs.push(createAssociatedTokenAccountInstruction(payerPk, sourceAta, sourcePk, mintPk, TOKEN_PROGRAM, ATA_PROGRAM))
    }
    const escrowInfo = await connection.getAccountInfo(escrowAta)
    if (!escrowInfo) {
      ixs.push(createAssociatedTokenAccountInstruction(payerPk, escrowAta, onftPda, mintPk, TOKEN_PROGRAM, ATA_PROGRAM))
    }
    ixs.push(createTransferInstruction(sourceAta, escrowAta, sourcePk, amount ?? 1, [], TOKEN_PROGRAM))

    const { blockhash } = await connection.getLatestBlockhash()
    const msg = new TransactionMessage({ payerKey: payerPk, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message()
    const vtx = new VersionedTransaction(msg)
    vtx.sign([web3JsKeypair, sourceSigner])
    const sig = await connection.sendTransaction(vtx)
    console.log(`✅ Registered id→mint and locked ${amount ?? 1} into escrow ${escrowAta.toBase58()} (tx: ${sig})`)
  })


