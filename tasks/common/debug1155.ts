import { task, types } from 'hardhat/config'
import { ActionType, HardhatRuntimeEnvironment } from 'hardhat/types'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import bs58 from 'bs58'

interface Args {
  dstEid: number
  to: string
  id: number
  amount: number
  contractName?: string
  send?: boolean
}

const action: ActionType<Args> = async (args, hre: HardhatRuntimeEnvironment) => {
  const { dstEid, to, id, amount, contractName = 'RoninNftBridge', send = false } = args

  const signer = await hre.ethers.getNamedSigner('deployer')
  const me = await signer.getAddress()

  const oapp = (await hre.ethers.getContract(contractName)).connect(signer)
  const erc1155 = await hre.ethers.getContractAt('IERC1155', process.env.ERC1155_ADDRESS as string, signer)

  console.log('Network:', hre.network.name)
  console.log('Deployer:', me)
  console.log('OApp   :', oapp.address)
  console.log('ERC1155:', process.env.ERC1155_ADDRESS)
  console.log('dstEid :', dstEid)
  console.log('to     :', to)
  console.log('id     :', id)
  console.log('amount :', amount)

  const toBytes32 = '0x' + Buffer.from(bs58.decode(to)).toString('hex')
  const options = Options.newOptions().toHex().toString()

  
  const bal = await erc1155.balanceOf(me, id)
  console.log('balanceOf(sender,id):', bal.toString())
  const approved = await erc1155.isApprovedForAll(me, oapp.address)
  console.log('isApprovedForAll(sender -> oapp):', approved)

  
  try {
    await erc1155.callStatic.safeTransferFrom(me, oapp.address, id, amount, '0x')
    console.log('ERC1155 callStatic.safeTransferFrom: OK')
  } catch (e: any) {
    console.log('ERC1155 callStatic.safeTransferFrom: REVERT', e?.error?.message || e?.message)
  }

  
  try {
    const peer = await oapp.peers(dstEid)
    console.log('peer(dstEid):', peer)
  } catch (e: any) {
    console.log('peer(dstEid) read error:', e?.error?.message || e?.message)
  }

  
  try {
    const fee = await oapp.quote1155(dstEid, toBytes32, id, amount, options, false)
    console.log('quote.nativeFee:', fee.nativeFee.toString())

    try {
      await oapp.callStatic.send1155(dstEid, toBytes32, id, amount, options, { value: fee.nativeFee })
      console.log('callStatic.send1155: OK')
    } catch (e: any) {
      console.log('callStatic.send1155: REVERT', e?.error?.message || e?.message)
    }

    if (send) {
      console.log('Sending tx...')
      const tx = await oapp.send1155(dstEid, toBytes32, id, amount, options, { value: fee.nativeFee })
      const rc = await tx.wait()
      console.log('tx.hash:', rc.transactionHash)
    }
  } catch (e: any) {
    console.log('quote1155 error:', e?.error?.message || e?.message)
  }
}

task('lz:oapp:debug1155', 'Диагностика и (опционально) отправка ERC-1155 через OApp', action)
  .addParam('dstEid', 'Destination endpoint ID', undefined, types.int, false)
  .addParam('to', 'Solana receiver address (base58)', undefined, types.string, false)
  .addParam('id', 'ERC-1155 Token ID', undefined, types.int, false)
  .addParam('amount', 'Amount of ERC-1155 tokens', undefined, types.int, false)
  .addOptionalParam('contractName', 'Name of the OApp contract in deployments folder', 'RoninNftBridge', types.string)
  .addFlag('send', 'Отправить реальную транзакцию после симуляции')


