import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import assert from 'node:assert'
import { publicKey } from '@metaplex-foundation/umi'
import { myoapp } from '../../lib/client'
import { PublicKey as Web3PublicKey, SystemProgram } from '@solana/web3.js'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { deriveConnection, getSolanaDeployment } from '../solana'

task('lz:oapp:solana:init-onft-adapter', 'Инициализирует OnftConfig и escrow ATA под mint')
  .addParam('eid', 'Solana EndpointId (e.g. 40168)', undefined, types.int)
  .addParam('mint', 'SPL mint (base58)')
  .setAction(async ({ eid, mint }: { eid: number; mint: string }, hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const [storePda] = client.pda.oapp()
    const onftPda = Web3PublicKey.findProgramAddressSync(
      [Buffer.from('ONFT')],
      toWeb3JsPublicKey(programId)
    )[0]
    const builder = myoapp.instructions.initOnftAdapter(
      { payer: umi.identity, programs: client.programRepo },
      {
        store: storePda,
        mint: publicKey(mint),
        tokenMint: publicKey(mint),
        onftConfig: publicKey(onftPda),
        associatedTokenProgram: publicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
        tokenProgram: publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        systemProgram: publicKey(SystemProgram.programId),
      }
    )
    const res = await builder.sendAndConfirm(umi)
    console.log('✅ init_onft_adapter sent, sig:', res.signature)
  })


