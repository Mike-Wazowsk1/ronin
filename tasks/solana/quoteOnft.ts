import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import assert from 'node:assert'
import { publicKey } from '@metaplex-foundation/umi'
import { myoapp } from '../../lib/client'
import { deriveConnection, getSolanaDeployment } from '../solana'
import { toWeb3JsInstruction, toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { PublicKey as Web3PublicKey } from '@solana/web3.js'

task('lz:oapp:solana:quote-onft', 'Quote native fee for ONFT send (Solana -> EVM)')
  .addParam('eid', 'Solana source endpoint id', undefined, types.int)
  .addParam('dstEid', 'Destination endpoint id', undefined, types.int)
  .addParam('toEvm', 'EVM receiver (0x...)', undefined, types.string)
  .addParam('id', 'ERC-1155 id (number)', undefined, types.int)
  .addParam('amount', 'Amount', undefined, types.int)
  .setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
    const { eid, dstEid, toEvm, id, amount } = args
    const { umi, connection } = await deriveConnection(eid, false)
    const deployment = getSolanaDeployment(eid)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const [storePda] = client.pda.oapp()

    const toHex = toEvm.replace(/^0x/, '')
    const toBuf = Buffer.from(toHex, 'hex')
    const to32 = Uint8Array.from([...(new Uint8Array(32 - toBuf.length)), ...toBuf])
    const idHex = BigInt(id).toString(16)
    const idBuf = Buffer.from(idHex.length % 2 === 0 ? idHex : `0${idHex}`, 'hex')
    const id32 = Uint8Array.from([...(new Uint8Array(32 - idBuf.length)), ...idBuf])
    const options = Options.newOptions().toBytes()

    const [peerPda] = client.pda.peer(Number(dstEid))
    const onftPda = Web3PublicKey.findProgramAddressSync([
      Buffer.from('ONFT')
    ], toWeb3JsPublicKey(programId))[0]
    const endpointSetting = client.endpointSDK.pda.setting()[0]

    const builder = myoapp.instructions.quoteSendOnft(
      { programs: client.programRepo },
      {
        store: storePda,
        peer: peerPda,
        endpoint: endpointSetting,
        dstEid: Number(dstEid),
        to: to32,
        id: id32,
        amount: Number(amount),
        options,
      }
    )
    // Simulate via web3.js to parse Anchor return data
    const recent = await connection.getLatestBlockhash()
    const payer = toWeb3JsPublicKey(umi.identity.publicKey)
    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: recent.blockhash,
      instructions: builder.getInstructions().map(ix => toWeb3JsInstruction(ix)),
    }).compileToV0Message()
    const vtx = new VersionedTransaction(messageV0)
    const sim = await connection.simulateTransaction(vtx, { sigVerify: false, replaceRecentBlockhash: true })
    const ret = sim.value.returnData
    if (!ret) {
      if (sim.value.logs) console.log('Sim logs:', sim.value.logs)
      // Fallback: quote via Endpoint directly using payload length equivalent to ONFT payload (72 bytes)
      const payload = new Uint8Array(72)
      try {
        const fee = await client.quote(umi.rpc, umi.identity.publicKey, {
          dstEid: Number(dstEid),
          message: payload,
          options,
          payInLzToken: false,
        })
        console.log('MessagingFee (endpoint):', fee)
      } catch (e) {
        console.log('No return data. RPC might not support it. And endpoint quote failed:', e)
      }
      return
    }
    const dataB64 = ret.data[0] as string
    const buf = Buffer.from(dataB64, 'base64')
    if (buf.length < 8 + 16) {
      console.log('Return data too short:', buf.length)
      return
    }
    const nativeFee = Number(buf.readBigUInt64LE(8))
    const lzTokenFee = Number(buf.readBigUInt64LE(16))
    console.log('MessagingFee:', { nativeFee, lzTokenFee })
  })


