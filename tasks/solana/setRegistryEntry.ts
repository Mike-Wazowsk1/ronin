import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { publicKey } from '@metaplex-foundation/umi'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { myoapp } from '../../lib/client'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'

function idToBytes32(id: string): Uint8Array {
  const bi = BigInt(id)
  const hex = bi.toString(16).padStart(64, '0')
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

task('lz:oapp:solana:set-registry-entry', 'Регистрирует пару id→mint в ончейн реестре')
  .addParam('eid', 'Solana EndpointId', undefined, types.int)
  .addParam('id', 'ERC-1155 id (decimal string)')
  .addParam('mint', 'SPL mint (base58)')
  .setAction(async ({ eid, id, mint }: { eid: number; id: string; mint: string }, _hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const id32 = idToBytes32(id)
    const [registry] = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT_REG')], new Web3PublicKey(deployment.programId))
    const [entry] = Web3PublicKey.findProgramAddressSync([Buffer.from('ONFT_REG_ENTRY'), Buffer.from(id32)], new Web3PublicKey(deployment.programId))
    const ix = myoapp.instructions.setRegistryEntry({ programs: client.programRepo }, {
      admin: umi.identity,
      store: client.pda.oapp()[0],
      registry: publicKey(registry),
      mint: publicKey(mint),
      entry: publicKey(entry),
      id32: Array.from(id32) as any,
    })
    const res = await ix.sendAndConfirm(umi)
    console.log('✅ set_registry_entry sent, sig:', res.signature)
  })


