import { task } from 'hardhat/config'
import { publicKey } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { transactionBuilder } from '@metaplex-foundation/umi'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { createLogger } from '@layerzerolabs/io-devtools'
import { addComputeUnitInstructions, deriveConnection, getAddressLookupTable, getSolanaDeployment, getSolanaOAppAddress } from './index'
import { MyOApp } from '../../lib/client/myoapp'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'

// Usage:
// npx hardhat solana:initPending --eid <EID> --id <hex32> --to <SOL_PUBKEY> --amount <u64>

task('solana:initPending', 'Initialize PendingClaim PDA on Solana')
  .addParam('eid', 'Solana EndpointId (e.g. 40168 for Devnet)')
  .addParam('id', '32-byte hex token id (without 0x)')
  .addParam('to', 'Solana recipient pubkey (base58)')
  .addParam('amount', 'Amount (u64)')
  .setAction(async (args, hre) => {
    const logger = createLogger()
    const eid = Number(args.eid) as EndpointId
    const idHex = args.id as string
    const toStr = args.to as string
    const amount = BigInt(args.amount)

    if (idHex.length !== 64) throw new Error('id must be 32-byte hex (64 chars)')
    const id32 = Uint8Array.from(Buffer.from(idHex, 'hex'))
    const toPk = publicKey(toStr)

    const { programId } = getSolanaDeployment(eid)
    const { connection, umi, umiWalletSigner } = await deriveConnection(eid)

    const myoapp = new MyOApp(publicKey(programId))
    const programIdW = new Web3PublicKey(programId)
    const [pendingPda] = Web3PublicKey.findProgramAddressSync([
      Buffer.from('CLAIM'),
      Buffer.from(id32),
    ], programIdW)

    const ix = myoapp.initPending({
      id32,
      to: toPk,
      amount: Number(amount),
      payer: umiWalletSigner,
      store: myoapp.pda.oapp()[0],
      pending: publicKey(pendingPda.toBase58()),
      systemProgram: publicKey('11111111111111111111111111111111'),
    })

    let txb = transactionBuilder().add(ix)
    txb = await addComputeUnitInstructions(connection, umi, eid, txb, umiWalletSigner, 1.1, 0 as any)

    const tx = await txb.sendAndConfirm(umi)
    logger.info(`PendingClaim initialized. Tx: ${tx.signature}`)
  })
