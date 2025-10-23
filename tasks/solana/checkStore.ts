import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey } from '@metaplex-foundation/umi'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { myoapp } from '../../lib/client'

task('lz:oapp:solana:check-store', 'Проверяет PDA store и его владельца (owner)')
  .addParam('eid', 'Solana EndpointId (e.g. 40168)', undefined, types.int)
  .setAction(async ({ eid }: { eid: number }, _hre: HardhatRuntimeEnvironment) => {
    const { connection } = await deriveConnection(eid as any, true)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const [storePda] = client.pda.oapp()

    const acc = await connection.getAccountInfo(toWeb3JsPublicKey(storePda))
    console.log('Program ID: ', deployment.programId)
    console.log('Store PDA  : ', storePda.toString())
    if (!acc) {
      console.log('❌ Store account not found on-chain. Запустите: npx hardhat lz:oapp:solana:create --eid', eid, '--program-id', deployment.programId)
      return
    }
    console.log('Owner      : ', acc.owner.toBase58())
    const ownerOk = acc.owner.equals(toWeb3JsPublicKey(programId))
    console.log(ownerOk ? 'ℹ️  Owner совпадает с программой.' : '⚠️  Owner не совпадает с программой. Деплой/инициализация некорректны или неверный eid/programId.')
  })


