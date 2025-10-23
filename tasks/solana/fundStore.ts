import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey as Web3PublicKey } from '@solana/web3.js'
import { toWeb3JsInstruction, toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'

import { myoapp } from '../../lib/client'
import { deriveConnection, getSolanaDeployment } from './index'

task('lz:oapp:solana:fund-store', 'Пополнить PDA store лампортами (оплата rent для PendingClaim)')
  .addParam('eid', 'Solana EndpointId (e.g. 40168)', undefined, types.int)
  .addOptionalParam('lamports', 'Сколько лампорт отправить (число)', undefined, types.int)
  .addOptionalParam('sol', 'Сколько SOL отправить (десятичное)', undefined, types.string)
  .setAction(async ({ eid, lamports, sol }: { eid: number; lamports?: number; sol?: string }, _hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)

    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const [storePda] = client.pda.oapp()

    let amountLamports: bigint
    if (sol != null) {
      const asFloat = parseFloat(sol)
      if (!Number.isFinite(asFloat) || asFloat <= 0) throw new Error('sol должно быть положительным числом')
      amountLamports = BigInt(Math.floor(asFloat * LAMPORTS_PER_SOL))
    } else if (lamports != null) {
      if (!Number.isFinite(lamports) || lamports <= 0) throw new Error('lamports должно быть положительным числом')
      amountLamports = BigInt(lamports)
    } else {
      
      amountLamports = BigInt(Math.floor(0.01 * LAMPORTS_PER_SOL))
    }

    const ix = SystemProgram.transfer({
      fromPubkey: toWeb3JsPublicKey(umi.identity.publicKey),
      toPubkey: new Web3PublicKey(storePda.toString()),
      lamports: Number(amountLamports),
    })

    const res = await transactionBuilder().add({ instruction: toWeb3JsInstruction(ix), signers: [] }).sendAndConfirm(umi)
    console.log('✅ Funded store PDA', storePda.toString(), 'lamports =', amountLamports.toString(), 'sig:', res.signature)
  })



