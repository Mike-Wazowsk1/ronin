import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import assert from 'node:assert'

interface Args {
  token?: string
  owner?: string
  fromBlock?: number
}

task('lz:oapp:list1155', 'Список tokenId ERC-1155 с ненулевым балансом у owner')
  .addOptionalParam('token', 'Адрес ERC-1155 (по умолчанию из ERC1155_ADDRESS)', undefined, types.string)
  .addOptionalParam('owner', 'Адрес владельца (по умолчанию named account "deployer")', undefined, types.string)
  .addOptionalParam('fromBlock', 'Блок начала сканирования событий', 0, types.int)
  .setAction(async (args: Args, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    const tokenAddress = args.token ?? process.env.ERC1155_ADDRESS
    assert(tokenAddress, 'Не указан адрес ERC1155: передайте --token или задайте ERC1155_ADDRESS в .env')

    const owner = args.owner ?? (await hre.ethers.getNamedSigner('deployer')).address

    console.log(`Network: ${network.name}`)
    console.log(`ERC1155: ${tokenAddress}`)
    console.log(`Owner  : ${owner}`)
    console.log(`fromBlock: ${args.fromBlock ?? 0}`)

    // 1) Быстрая проверка ERC165 на совместимость с ERC-1155
    try {
      const erc165 = await ethers.getContractAt('IERC165', tokenAddress)
      const is1155 = await erc165.supportsInterface('0xd9b67a26')
      if (!is1155) {
        console.warn('⚠️  Контракт не заявляет поддержку ERC-1155 (IERC165). Продолжаю, но результаты могут быть некорректны.')
      } else {
        console.log('✅ IERC165: контракт поддерживает интерфейс ERC-1155')
      }
    } catch {
      console.warn('⚠️  Не удалось проверить IERC165. Продолжаю...')
    }

    const provider = ethers.provider
    const topicSingle = ethers.utils.id('TransferSingle(address,address,address,uint256,uint256)')
    const topicBatch = ethers.utils.id('TransferBatch(address,address,address,uint256[],uint256[])')

    const latestBlock = await provider.getBlockNumber()
    const defaultStart = Math.max(latestBlock - 9500, 0)
    const startBlock = args.fromBlock ?? defaultStart
    const step = 5000 // размер чанка, чтобы не упираться в лимиты RPC

    async function getLogsPaged(topic: string) {
      const out: Array<any> = []
      let from = startBlock
      while (from <= latestBlock) {
        const to = Math.min(from + step - 1, latestBlock)
        const filter = { address: tokenAddress, topics: [topic], fromBlock: from, toBlock: to }
        try {
          const logs = await provider.getLogs(filter)
          out.push(...logs)
        } catch (e) {
          // если все еще большая выборка — попробуем меньшим шагом
          const smallerStep = Math.floor(step / 5)
          if (smallerStep >= 100) {
            for (let f = from; f <= to; f += smallerStep) {
              const t = Math.min(f + smallerStep - 1, to)
              const smallFilter = { address: tokenAddress, topics: [topic], fromBlock: f, toBlock: t }
              const smallLogs = await provider.getLogs(smallFilter)
              out.push(...smallLogs)
            }
          } else {
            throw e
          }
        }
        from = to + 1
      }
      return out
    }

    const [logsSingle, logsBatch] = await Promise.all([
      getLogsPaged(topicSingle),
      getLogsPaged(topicBatch),
    ])

    const ifaceSingle = new ethers.utils.Interface([
      'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)',
    ])
    const ifaceBatch = new ethers.utils.Interface([
      'event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)',
    ])

    const candidateIds = new Set<string>()

    for (const l of logsSingle) {
      try {
        const { args: a } = ifaceSingle.parseLog(l)
        if (
          a.to.toLowerCase() === owner.toLowerCase() ||
          a.from.toLowerCase() === owner.toLowerCase()
        ) {
          candidateIds.add(a.id.toString())
        }
      } catch {}
    }

    for (const l of logsBatch) {
      try {
        const { args: a } = ifaceBatch.parseLog(l)
        if (
          a.to.toLowerCase() === owner.toLowerCase() ||
          a.from.toLowerCase() === owner.toLowerCase()
        ) {
          const ids: Array<any> = a.ids
          for (const id of ids) candidateIds.add(id.toString())
        }
      } catch {}
    }

    console.log(`Событий TransferSingle: ${logsSingle.length}, TransferBatch: ${logsBatch.length}`)
    console.log(`Найдено потенциальных tokenId: ${candidateIds.size}`)

    const erc1155 = await ethers.getContractAt('IERC1155', tokenAddress)
    const balances: Array<{ id: string; balance: string }> = []

    for (const id of candidateIds) {
      try {
        const bal = await erc1155.balanceOf(owner, id)
        if (!bal.isZero()) balances.push({ id, balance: bal.toString() })
      } catch (e) {
        console.warn(`⚠️  balanceOf(${owner}, ${id}) → ошибка: ${(e as Error).message}`)
      }
    }

    balances.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)

    console.log('\nTokenId с ненулевым балансом:')
    if (balances.length === 0) {
      console.log('— не найдено')
    } else {
      for (const { id, balance } of balances) {
        console.log(`id=${id} balance=${balance}`)
      }
    }

    console.log('\nСправка: ERC-1155 может быть как "штучным", так и мультикопийным по id. Поэтому баланс по одному id может быть > 1 — это норма для 1155 и отличается от ERC-721.')
  })


