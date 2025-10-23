import { publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import bs58 from 'bs58'
import { task, types } from 'hardhat/config'
import { ActionType, HardhatRuntimeEnvironment } from 'hardhat/types'

import { ChainType, endpointIdToChainType } from '@layerzerolabs/lz-definitions'
import { Options } from '@layerzerolabs/lz-v2-utilities'

import { myoapp } from '../../lib/client'
import { TransactionType, addComputeUnitInstructions, deriveConnection, getSolanaDeployment } from '../solana/index'
import { getLayerZeroScanLink, isV2Testnet } from '../utils'

interface TaskArguments {
    fromEid: number
    dstEid: number
    message: string
    computeUnitPriceScaleFactor: number
    contractName: string
}

const action: ActionType<TaskArguments> = async (
    { fromEid, dstEid, message, computeUnitPriceScaleFactor, contractName },
    hre: HardhatRuntimeEnvironment
) => {
    if (endpointIdToChainType(fromEid) === ChainType.SOLANA) {
        await sendFromSolana(fromEid, dstEid, message, computeUnitPriceScaleFactor)
    } else if (endpointIdToChainType(fromEid) === ChainType.EVM) {
        await sendFromEvm(dstEid, message, contractName, hre)
    } else {
        throw new Error(`Unsupported ChainType for fromEid ${fromEid}`)
    }
}

async function sendFromSolana(fromEid: number, dstEid: number, message: string, computeUnitPriceScaleFactor: number) {
    const solanaEid = fromEid
    const solanaDeployment = getSolanaDeployment(solanaEid)
    const { connection, umi, umiWalletSigner } = await deriveConnection(solanaEid)

    const myoappInstance: myoapp.RoninNftBridge = new myoapp.RoninNftBridge(publicKey(solanaDeployment.programId))

    const options = Options.newOptions().toBytes() // leaving empty, relying on enforced options instead

    const { nativeFee } = await myoappInstance.quote(umi.rpc, umiWalletSigner.publicKey, {
        dstEid,
        message,
        options,
        payInLzToken: false,
    })

    console.log('🔖 Native fee quoted:', nativeFee.toString())

    let txBuilder = transactionBuilder().add(
        await myoappInstance.send(umi.rpc, umiWalletSigner.publicKey, {
            dstEid,
            message,
            options,
            nativeFee,
        })
    )
    txBuilder = await addComputeUnitInstructions(
        connection,
        umi,
        fromEid,
        txBuilder,
        umiWalletSigner,
        computeUnitPriceScaleFactor,
        TransactionType.SendMessage
    )
    const tx = await txBuilder.sendAndConfirm(umi)
    const txHash = bs58.encode(tx.signature)

    console.log('✉️  Cross-chain message:', `"${message}"`, '→ endpointId', dstEid)
    console.log('🧾 Transaction hash:', txHash)
    console.log('🌐 Track transfer:', getLayerZeroScanLink(txHash, isV2Testnet(dstEid)))
}

async function sendFromEvm(dstEid: number, message: string, contractName: string, hre: HardhatRuntimeEnvironment) {
    const signer = await hre.ethers.getNamedSigner('deployer')

    // @ts-expect-error signer is fine
    const myOApp = (await hre.ethers.getContract(contractName)).connect(signer)

    const options = Options.newOptions().toHex().toString() // leaving empty, relying on enforced options instead

    const [nativeFee] = await myOApp.quote(dstEid, message, options, false)

    console.log('🔖 Native fee quoted:', nativeFee.toString())

    const txResponse = await myOApp.send(dstEid, message, options, {
        value: nativeFee,
    })
    const txReceipt = await txResponse.wait()

    console.log('✉️  Cross-chain message:', `"${message}"`, '→ endpointId', dstEid)
    console.log('🧾 Transaction hash:', txReceipt.transactionHash)
    console.log('🌐 Track transfer:', getLayerZeroScanLink(txReceipt.transactionHash, isV2Testnet(dstEid)))
}

// Note: for testing reference, Optimism Sepolia's eid is 40232 and Solana Devnet's eid is 40168
task('lz:oapp:send', 'Sends a string message cross-chain', action)
    .addParam('fromEid', 'Source endpoint ID', undefined, types.int, false)
    .addParam('dstEid', 'Destination endpoint ID', undefined, types.int, false)
    .addParam('message', 'String message to send', undefined, types.string, false)
    .addParam('computeUnitPriceScaleFactor', 'The compute unit price scale factor', 4, types.float, true) // only if fromEid is Solana
    .addOptionalParam('contractName', 'Name of the OApp contract in deployments folder', 'MyOApp', types.string) // only if fromEid is EVM

// ---------------------
// ERC-1155 ONFT send (Sepolia -> Solana)
// ---------------------
interface Send1155Args {
    dstEid: number
    to: string // Solana base58 pubkey
    id: string
    amount: string
    contractName: string
}

const send1155Action: ActionType<Send1155Args> = async ({ dstEid, to, id, amount, contractName }, hre) => {
    const signer = await hre.ethers.getNamedSigner('deployer')
    // @ts-expect-error signer is fine
    const myOApp = (await hre.ethers.getContract(contractName)).connect(signer)

    const to32 = '0x' + Buffer.from(bs58.decode(to)).toString('hex')
    const options = '0x'

    const fee = await myOApp.quote1155(dstEid, to32, hre.ethers.BigNumber.from(id), hre.ethers.BigNumber.from(amount), options, false)
    const nativeFee = fee.nativeFee ?? fee[0]
    console.log('🔖 Native fee quoted:', nativeFee.toString())

    const tx = await myOApp.send1155(dstEid, to32, hre.ethers.BigNumber.from(id), hre.ethers.BigNumber.from(amount), options, { value: nativeFee })
    const rc = await tx.wait()
    console.log('🧾 Transaction hash:', rc.transactionHash)
}

task('lz:oapp:send1155', 'Send ERC-1155 as ONFT from EVM to Solana', send1155Action)
    .addParam('dstEid', 'Destination endpoint ID', undefined, types.int, false)
    .addParam('to', 'Solana destination (base58)', undefined, types.string, false)
    .addParam('id', 'ERC-1155 token id (uint256)', undefined, types.string, false)
    .addParam('amount', 'ERC-1155 amount (u64)', undefined, types.string, false)
    .addOptionalParam('contractName', 'Name of the OApp contract', 'MyOApp', types.string)

// ---------------------
// ERC-1155 ONFT send (EVM -> EVM)
// ---------------------
interface Send1155EvmArgs {
    dstEid: number
    to: string // EVM address (0x...)
    id: string
    amount: string
    contractName: string
}

const send1155EvmAction: ActionType<Send1155EvmArgs> = async ({ dstEid, to, id, amount, contractName }, hre) => {
    const signer = await hre.ethers.getNamedSigner('deployer')
    // @ts-expect-error signer is fine
    const myOApp = (await hre.ethers.getContract(contractName)).connect(signer)

    const toAddr = hre.ethers.utils.getAddress(to)
    const to32 = hre.ethers.utils.hexZeroPad(toAddr, 32)
    const options = '0x'

    const fee = await myOApp.quote1155(dstEid, to32, hre.ethers.BigNumber.from(id), hre.ethers.BigNumber.from(amount), options, false)
    const nativeFee = fee.nativeFee ?? fee[0]
    console.log('🔖 Native fee quoted:', nativeFee.toString())

    const tx = await myOApp.send1155(dstEid, to32, hre.ethers.BigNumber.from(id), hre.ethers.BigNumber.from(amount), options, { value: nativeFee })
    const rc = await tx.wait()
    console.log('🧾 Transaction hash:', rc.transactionHash)
}

task('lz:oapp:send1155:evm', 'Send ERC-1155 as ONFT from EVM to EVM', send1155EvmAction)
    .addParam('dstEid', 'Destination endpoint ID', undefined, types.int, false)
    .addParam('to', 'EVM destination (0x address)', undefined, types.string, false)
    .addParam('id', 'ERC-1155 token id (uint256)', undefined, types.string, false)
    .addParam('amount', 'ERC-1155 amount (u64)', undefined, types.string, false)
    .addOptionalParam('contractName', 'Name of the OApp contract', 'MyOApp', types.string)
