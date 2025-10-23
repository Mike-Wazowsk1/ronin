import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import bs58 from 'bs58'
import assert from 'node:assert'
import { publicKey } from '@metaplex-foundation/umi'
import { toWeb3JsInstruction, toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { myoapp } from '../../lib/client'
import { accounts as genAccounts } from '../../lib/client'
import { deriveConnection, getSolanaDeployment, addComputeUnitInstructions, TransactionType } from '../solana'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import { PublicKey as Web3PublicKey, SystemProgram } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'

task('lz:oapp:solana:send-onft', 'Lock + send ONFT from Solana to EVM')
  .addParam('eid', 'Solana source endpoint id', undefined, types.int)
  .addParam('dstEid', 'Destination endpoint id', undefined, types.int)
  .addParam('toEvm', 'EVM receiver address (0x...)', undefined, types.string)
  .addParam('id', 'ERC-1155 id (number) → will be packed into bytes32', undefined, types.int)
  .addParam('amount', 'Amount', undefined, types.int)
  .addOptionalParam('nativeFee', 'Override native fee (lamports)', undefined, types.int)
  .addOptionalParam('lzTokenFee', 'Override lzToken fee (lamports)', undefined, types.int)
  .addOptionalParam('mint', 'SPL mint (if auto-read fails)', undefined, types.string)
  .setAction(async (args: any, hre: HardhatRuntimeEnvironment) => {
    const { eid, dstEid, toEvm, id, amount, nativeFee: feeOverride, lzTokenFee: lzFeeOverride, mint } = args
    const { umi, connection, umiWalletKeyPair, umiWalletSigner } = await deriveConnection(eid, false)
    const deployment = getSolanaDeployment(eid)
    const programId = publicKey(deployment.programId)
    const client = new myoapp.RoninNftBridge(programId)
    const [storePda] = client.pda.oapp()

    // to bytes32 (Uint8Array)
    const toHex = toEvm.replace(/^0x/, '')
    const toBuf = Buffer.from(toHex, 'hex')
    const to32 = Uint8Array.from([...(new Uint8Array(32 - toBuf.length)), ...toBuf])
    const idHex = BigInt(id).toString(16)
    const idBuf = Buffer.from(idHex.length % 2 === 0 ? idHex : `0${idHex}`, 'hex')
    const id32 = Uint8Array.from([...(new Uint8Array(32 - idBuf.length)), ...idBuf])
    const options = Options.newOptions().toBytes()

    // quote via simulate or overrides
    let nativeFee = Number(feeOverride ?? 0)
    let lzTokenFee = Number(lzFeeOverride ?? 0)
    if (!feeOverride) {
      try {
        const quoteBuilder = myoapp.instructions.quoteSendOnft(
          { programs: client.programRepo },
          {
            store: storePda,
            dstEid: Number(dstEid),
            to: to32 as any,
            id: id32 as any,
            amount: Number(amount),
            options: options as any,
          },
        )
        const recent = (await umi.rpc.getLatestBlockhash()).value
        const payer = toWeb3JsPublicKey(umi.identity.publicKey)
        const messageV0 = new TransactionMessage({
          payerKey: payer,
          recentBlockhash: recent.blockhash,
          instructions: quoteBuilder.getInstructions().map(ix => toWeb3JsInstruction(ix)),
        }).compileToV0Message()
        const vtx = new VersionedTransaction(messageV0)
        const sim = await (await deriveConnection(eid, true)).connection.simulateTransaction(vtx, { sigVerify: false, replaceRecentBlockhash: true })
        if (sim.value.returnData) {
          const dataB64 = sim.value.returnData.data[0] as string
          const buf = Buffer.from(dataB64, 'base64')
          if (buf.length >= 24) {
            nativeFee = Number(buf.readBigUInt64LE(8))
            lzTokenFee = Number(buf.readBigUInt64LE(16))
          }
        }
      } catch {
        // fall back to user-provided default if any
        if (!feeOverride) {
          throw new Error('Failed to get quote automatically. Specify --native-fee (in lamports).')
        }
      }
    }
    const [peerPda] = client.pda.peer(Number(dstEid))
    const onftPda = Web3PublicKey.findProgramAddressSync([
      Buffer.from('ONFT')
    ], toWeb3JsPublicKey(programId))[0]
    // derive registry + entry PDAs required by program
    const registryPda = Web3PublicKey.findProgramAddressSync([
      Buffer.from('ONFT_REG')
    ], toWeb3JsPublicKey(programId))[0]
    const entryPda = Web3PublicKey.findProgramAddressSync([
      Buffer.from('ONFT_REG_ENTRY'),
      Buffer.from(id32)
    ], toWeb3JsPublicKey(programId))[0]
    let mintPk = mint ? publicKey(mint) : undefined
    if (!mintPk) {
      try {
        const onftAcc = await genAccounts.fetchOnftConfig(umi, publicKey(onftPda))
        mintPk = onftAcc.data.tokenMint
      } catch (e) {
        throw new Error('Не удалось прочитать OnftConfig для получения mint. Укажите --mint <pubkey>.')
      }
    }
    // derive user ATA and escrow deterministically (do not rely on stored escrow)
    const mintWeb3 = toWeb3JsPublicKey(mintPk!)
    const ownerWeb3 = toWeb3JsPublicKey(umi.identity.publicKey)
    const userAtaWeb3 = await getAssociatedTokenAddress(
      mintWeb3,
      ownerWeb3,
      false,
      new Web3PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      new Web3PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    )
    const escrowWeb3 = await getAssociatedTokenAddress(
      mintWeb3,
      onftPda,
      true,
      new Web3PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      new Web3PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    )
    const userAtaPk = publicKey(userAtaWeb3)
    const escrowPk = publicKey(escrowWeb3)
    // remaining accounts required by Endpoint CPI
    const receiverInfo = await genAccounts.fetchPeerConfig(umi, client.pda.peer(Number(dstEid))[0])
    const msgLibProgram = await client.getSendLibraryProgram(umi.rpc, umi.identity.publicKey, Number(dstEid))
    const remainingAccounts = await client.endpointSDK.getSendIXAccountMetaForCPI(
      umi.rpc,
      umi.identity.publicKey,
      {
        path: {
          dstEid: Number(dstEid),
          sender: storePda,
          receiver: receiverInfo.peerAddress,
        },
        msgLibProgram,
      },
    )

    const sendBuilder = myoapp.instructions.sendOnft(
      { programs: client.programRepo },
      {
        signer: umi.identity,
        peer: peerPda,
        store: storePda,
        mint: mintPk!,
        onftConfig: publicKey(onftPda),
        registry: publicKey(registryPda),
        registryEntry: publicKey(entryPda),
        userToken: userAtaPk!,
        escrow: escrowPk!,
        tokenProgram: publicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        associatedTokenProgram: publicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
        systemProgram: publicKey(SystemProgram.programId),
        dstEid: Number(dstEid),
        to: to32 as any,
        id: id32 as any,
        amount: Number(amount),
        options: options as any,
        nativeFee,
        lzTokenFee,
      },
    ).addRemainingAccounts(remainingAccounts)
    const builderWithCu = await addComputeUnitInstructions(
      // @ts-expect-error connection type difference between web3js versions is fine
      connection,
      umi,
      Number(eid),
      sendBuilder,
      umiWalletSigner,
      1.3, // scale priority fee a bit to avoid congestion issues
      TransactionType.SendOFT,
    )
    const res = await builderWithCu.sendAndConfirm(umi)
    console.log('✅ send_onft sent, sig:', res.signature)
  })


