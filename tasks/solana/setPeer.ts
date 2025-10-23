import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { myoapp } from '../../lib/client'
import { deriveConnection, getSolanaDeployment } from '../solana'

task('lz:oapp:solana:set-peer', 'Устанавливает peer (bytes32) для удалённого EID на Солане')
  .addParam('eid', 'Solana EndpointId (локальный)', undefined, types.int)
  .addParam('remoteEid', 'Удалённый endpoint id (EVM)', undefined, types.int)
  .addParam('peer', 'Адрес удалённого OApp в bytes32 (0x...64 hex)', undefined, types.string)
  .setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
    const { eid, remoteEid, peer } = args
    const { umi } = await deriveConnection(eid, false)
    const deployment = getSolanaDeployment(eid)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)

    const hex = (peer as string).replace(/^0x/, '')
    if (hex.length !== 64) throw new Error('peer должен быть bytes32 (64 hex-символа)')
    const peerBytes = Uint8Array.from(Buffer.from(hex, 'hex'))

    const ix = client.setPeerConfig(
      { admin: umi.identity },
      { __kind: 'PeerAddress', peer: peerBytes, remote: Number(remoteEid) }
    )

    const res = await transactionBuilder().add(ix).sendAndConfirm(umi)
    console.log('✅ set_peer sent, sig:', res.signature)
  })


