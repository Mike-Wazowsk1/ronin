import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { initConfig as buildInitOAppConfig } from '../../lib/client/myoapp'

task('lz:oapp:solana:init-oapp-config', 'Инициализирует OApp config (msg lib/endpoint) для remoteEid на Солане')
  .addParam('eid', 'Solana EndpointId (напр. 40168)', undefined, types.int)
  .addParam('remoteEid', 'Удалённый EndpointId (напр. 40161)', undefined, types.int)
  .setAction(async ({ eid, remoteEid }: { eid: number; remoteEid: number }, _hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)

    const ix = buildInitOAppConfig(programId, { admin: umi.identity, payer: umi.identity }, Number(remoteEid))
    const res = await transactionBuilder().add(ix).sendAndConfirm(umi)
    console.log('✅ init_oapp_config sent, sig:', res.signature)
  })


