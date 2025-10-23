import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import assert from 'node:assert'
import bs58 from 'bs58'

interface Args {
  token?: string
  owner?: string
  ids: string
  amount?: number
  to?: string
  dstEid?: number
}

task('lz:oapp:check1155', 'Проверка ERC-1155 по переданным id без сканирования событий')
  .addOptionalParam('token', 'Адрес ERC-1155 (по умолчанию из ERC1155_ADDRESS)', undefined, types.string)
  .addOptionalParam('owner', 'Адрес владельца (по умолчанию named account "deployer")', undefined, types.string)
  .addParam('ids', 'Список id через запятую, например "1,2,3"')
  .addOptionalParam('amount', 'Количество для симуляции перевода и send (по умолчанию 1)', 1, types.int)
  .addOptionalParam('to', 'Solana base58 адрес получателя для send1155 (опционально)', undefined, types.string)
  .addOptionalParam('dstEid', 'LayerZero dstEid (опционально, для send1155)', 40168, types.int)
  .setAction(async (args: Args, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre
    const tokenAddress = args.token ?? process.env.ERC1155_ADDRESS
    assert(tokenAddress, 'Не указан адрес ERC1155: передайте --token или задайте ERC1155_ADDRESS в .env')

    const owner = args.owner ?? (await hre.ethers.getNamedSigner('deployer')).address
    const amount = args.amount ?? 1
    const ids = args.ids.split(',').map((s) => s.trim()).filter(Boolean)
    assert(ids.length > 0, 'Передайте хотя бы один id через --ids')

    console.log(`Network: ${network.name}`)
    console.log(`ERC1155: ${tokenAddress}`)
    console.log(`Owner  : ${owner}`)
    console.log(`Ids    : ${ids.join(', ')}`)
    console.log(`Amount : ${amount}`)

    const erc1155 = await ethers.getContractAt('IERC1155', tokenAddress)
    const oapp = await ethers.getContract('RoninNftBridge')

    // supportsInterface
    try {
      const erc165 = await ethers.getContractAt('IERC165', tokenAddress)
      const is1155 = await erc165.supportsInterface('0xd9b67a26')
      console.log(`IERC165 ERC1155: ${is1155}`)
    } catch {
      console.log('IERC165 ERC1155: unknown (skip)')
    }

    // approval
    const isApproved = await erc1155.isApprovedForAll(owner, oapp.address)
    console.log(`isApprovedForAll(owner -> oapp): ${isApproved}`)

    // balances и локальная симуляция перевода на OApp
    const signer = await ethers.getNamedSigner('deployer')
    for (const id of ids) {
      const bal = await erc1155.balanceOf(owner, id)
      console.log(`balanceOf(owner, ${id}) = ${bal.toString()}`)
      if (!bal.isZero()) {
        try {
          await erc1155.connect(signer).callStatic.safeTransferFrom(owner, oapp.address, id, amount, '0x')
          console.log(`safeTransferFrom(owner -> oapp, id=${id}, amount=${amount}): OK`)
        } catch (e: any) {
          console.log(`safeTransferFrom(owner -> oapp, id=${id}, amount=${amount}): REVERT ${e?.error?.message || e.message}`)
        }
      }
    }

    // По желанию: симуляция LayerZero отправки
    if (args.to) {
      const toBytes32 = '0x' + Buffer.from(bs58.decode(args.to)).toString('hex')
      const dstEid = args.dstEid ?? 40168
      const options = '0x'

      for (const id of ids) {
        const bal = await erc1155.balanceOf(owner, id)
        if (bal.gte(amount)) {
          try {
            const fee = await oapp.quote1155(dstEid, toBytes32, id, amount, options, false)
            console.log(`quote1155(id=${id}) nativeFee: ${fee.nativeFee.toString()}`)
            await oapp.callStatic.send1155(dstEid, toBytes32, id, amount, options, { value: fee.nativeFee })
            console.log(`callStatic.send1155(id=${id}): OK`)
          } catch (e: any) {
            console.log(`callStatic.send1155(id=${id}): REVERT ${e?.error?.message || e.message}`)
          }
        } else {
          console.log(`skip id=${id}: баланс ${bal.toString()} < amount ${amount}`)
        }
      }
    }
  })


