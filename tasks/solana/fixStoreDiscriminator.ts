import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { publicKey } from '@metaplex-foundation/umi'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import * as myoapp from '../../lib/client/generated/ronin_nft_bridge'

task('lz:oapp:solana:fix-store-discriminator', 'Fix store account discriminator after program structure changes')
  .addParam('eid', 'Solana EndpointId', undefined, types.int)
  .setAction(async ({ eid }: { eid: number }, _hre: HardhatRuntimeEnvironment) => {
    const { umi } = await deriveConnection(eid as any, false)
    const deployment = getSolanaDeployment(eid as any)
    const programId = publicKey(deployment.programId)

    // Use actual store address from deployment
    const storePda = new Web3PublicKey(deployment.oapp)

    console.log('🔧 Fixing store discriminator...')
    console.log('Program ID:', deployment.programId)
    console.log('Store PDA:', storePda.toBase58())

    try {
      // Call fix_store_discriminator instruction
      const tx = myoapp.fixStoreDiscriminator(umi, {
        store: publicKey(storePda),
        admin: umi.identity,
        programs: { myOapp: programId }
      })

      const result = await tx.sendAndConfirm(umi)
      
      console.log('✅ Store discriminator fixed successfully!')
      console.log('Transaction signature:', result.signature)
      
    } catch (error: any) {
      console.error('❌ Failed to fix store discriminator:', error?.message || error)
      throw error
    }
  })
