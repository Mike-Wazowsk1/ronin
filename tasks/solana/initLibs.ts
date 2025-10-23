import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { initReceiveLibrary, initSendLibrary } from '../../lib/client/myoapp'

task('lz:oapp:solana:init-libs', 'Инициализирует send/receive библиотеки для указанного remoteEid на Солане')
  .addParam('eid', 'Solana EndpointId (например, 40168)', undefined, types.int)
  .addParam('remoteEid', 'Удалённый EndpointId (например, 40161 для Sepolia)', undefined, types.int)
  .setAction(async ({ eid, remoteEid }: { eid: number; remoteEid: number }, _hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const oappPk = publicKey(deployment.oapp)

    // send library
    try {
      const resSend = await transactionBuilder()
        .add(initSendLibrary({ admin: umi.identity, oapp: oappPk }, Number(remoteEid)))
        .sendAndConfirm(umi)
      console.log('✅ init_send_library ok, sig:', resSend.signature)
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (/already in use|already initialized/i.test(msg)) {
        console.log('ℹ️  init_send_library: уже инициализировано, пропускаю')
      } else {
        console.warn('⚠️  init_send_library failed, продолжаю к receive:', msg)
      }
    }

    // receive library
    try {
      const resRecv = await transactionBuilder()
        .add(initReceiveLibrary({ admin: umi.identity, oapp: oappPk }, Number(remoteEid)))
        .sendAndConfirm(umi)
      console.log('✅ init_receive_library ok, sig:', resRecv.signature)
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (/already in use|already initialized/i.test(msg)) {
        console.log('ℹ️  init_receive_library: уже инициализировано')
      } else {
        console.error('❌ init_receive_library failed:', msg)
        throw e
      }
    }
  })


