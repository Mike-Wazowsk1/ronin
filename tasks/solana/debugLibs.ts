import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { PublicKey } from '@solana/web3.js'
import { EndpointPDADeriver } from '@layerzerolabs/lz-solana-sdk-v2'
import { deriveConnection, getSolanaDeployment } from '../solana'

task('lz:oapp:solana:debug-libs', 'Печатает PDA receive/send configs для remoteEid и их наличие')
  .addParam('eid', 'Solana EndpointId (напр. 40168)', undefined, types.int)
  .addParam('remoteEid', 'Удалённый EndpointId (напр. 40161)', undefined, types.int)
  .setAction(async ({ eid, remoteEid }: { eid: number; remoteEid: number }, _hre: HardhatRuntimeEnvironment) => {
    const { connection } = await deriveConnection(eid as any, true)
    const { oapp } = getSolanaDeployment(eid as any)

    const endpoint = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
    const deriver = new EndpointPDADeriver(endpoint)

    const [sendLibCfg] = deriver.oappSendLibraryConfig(new PublicKey(oapp), Number(remoteEid))
    const [recvLibCfg] = deriver.oappReceiveLibraryConfig(new PublicKey(oapp), Number(remoteEid))
    const [recvLibTimeoutCfg] = deriver.oappReceiveLibraryTimeoutConfig(new PublicKey(oapp), Number(remoteEid))
    const [oappCfg] = deriver.oappConfig(new PublicKey(oapp), Number(remoteEid))

    const acc = async (pk: PublicKey) => (await connection.getAccountInfo(pk)) != null

    const exists = await Promise.all([
      acc(sendLibCfg),
      acc(recvLibCfg),
      acc(recvLibTimeoutCfg),
      acc(oappCfg),
    ])

    console.log('PDAs for remoteEid=', remoteEid)
    console.log('sendLibraryConfig   ', sendLibCfg.toBase58(), exists[0] ? 'EXISTS' : 'MISSING')
    console.log('receiveLibraryConfig', recvLibCfg.toBase58(), exists[1] ? 'EXISTS' : 'MISSING')
    console.log('receiveTimeoutConfig', recvLibTimeoutCfg.toBase58(), exists[2] ? 'EXISTS' : 'MISSING')
    console.log('oappConfig          ', oappCfg.toBase58(), exists[3] ? 'EXISTS' : 'MISSING')
  })


