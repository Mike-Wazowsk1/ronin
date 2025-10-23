import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey } from '@metaplex-foundation/umi'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { myoapp } from '../../lib/client'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'

task('lz:oapp:solana:init-registry', 'Инициализирует реестр id→mint (PDA ONFT_REG)')
  .addParam('eid', 'Solana EndpointId (напр. 40168)', undefined, types.int)
  .setAction(async ({ eid }: { eid: number }, _hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const [registry] = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT_REG')], new Web3PublicKey(deployment.programId))
    const ix = myoapp.instructions.initRegistry({ payer: umi.identity, programs: client.programRepo }, {
      store: client.pda.oapp()[0],
      registry: publicKey(registry),
      systemProgram: publicKey('11111111111111111111111111111111'),
    })
    const res = await ix.sendAndConfirm(umi)
    console.log('✅ init_registry sent, sig:', res.signature)
  })
