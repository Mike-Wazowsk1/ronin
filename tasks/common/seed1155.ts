import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'

interface Args {
  token?: string
  owner?: string
  ids?: string // comma-separated list
  file?: string // path to JSON array of ids
  batch?: boolean
}

function resolveErc1155FromEnv(networkName: string): string | undefined {
  const env = process.env as Record<string, string | undefined>
  const byNetwork: Record<string, string | undefined> = {
    'sepolia-testnet': env.ERC1155_ADDRESS_SEPOLIA,
    sepolia: env.ERC1155_ADDRESS_SEPOLIA,
    'optimism-sepolia': env.ERC1155_ADDRESS_OPTIMISM_SEPOLIA,
    'optimism-testnet': env.ERC1155_ADDRESS_OPTIMISM_SEPOLIA,
  }
  return byNetwork[networkName] ?? env.ERC1155_ADDRESS
}

function parseIds(args: Args): string[] {
  if (args.file) {
    assert(existsSync(args.file), `file not found: ${args.file}`)
    const raw = readFileSync(args.file, 'utf8')
    const arr = JSON.parse(raw)
    assert(Array.isArray(arr), 'file must contain a JSON array of ids (as decimal strings)')
    return arr.map((v: any) => String(v))
  }
  const ids = (args.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  assert(ids.length > 0, 'provide --ids "1,2,3" or --file ids.json')
  return ids
}

task('lz:oapp:evm:seed-1155', 'Transfers all owned balances for given ERC-1155 ids to RoninNftBridge (locks inventory on this EVM)')
  .addOptionalParam('token', 'ERC-1155 address (defaults to ENV)', undefined, types.string)
  .addOptionalParam('owner', 'Owner address (defaults to named account "deployer")', undefined, types.string)
  .addOptionalParam('ids', 'Comma-separated ids, e.g. "1,2,3"', undefined, types.string)
  .addOptionalParam('file', 'Path to JSON array of ids', undefined, types.string)
  .addOptionalParam('batch', 'Use safeBatchTransferFrom when possible', true, types.boolean)
  .setAction(async (args: Args, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre
    const token = args.token ?? resolveErc1155FromEnv(network.name)
    assert(token, 'ERC-1155 address not provided. Pass --token or set ERC1155_ADDRESS[_SEPOLIA/_OPTIMISM_SEPOLIA] in .env')

    const ids = parseIds(args)
    const owner = args.owner ?? (await ethers.getNamedSigner('deployer')).address
    const signer = await ethers.getNamedSigner('deployer')
    const oapp = await ethers.getContract('RoninNftBridge')
    const erc1155 = await ethers.getContractAt('IERC1155', token)

    console.log(`Network: ${network.name}`)
    console.log(`ERC1155: ${token}`)
    console.log(`Owner  : ${owner}`)
    console.log(`OApp   : ${oapp.address}`)
    console.log(`Ids    : ${ids.join(', ')}`)

    // ensure approval
    const approved = await erc1155.isApprovedForAll(owner, oapp.address)
    if (!approved) {
      console.log('setApprovalForAll(owner -> oapp): sending...')
      const tx = await erc1155.connect(signer).setApprovalForAll(oapp.address, true)
      await tx.wait()
      console.log('setApprovalForAll: OK')
    } else {
      console.log('setApprovalForAll: already true')
    }

    // read balances
    const balances: { id: string; amount: string }[] = []
    for (const id of ids) {
      const bal = await erc1155.balanceOf(owner, id)
      if (!bal.isZero()) {
        balances.push({ id, amount: bal.toString() })
      }
      console.log(`balanceOf(${owner}, ${id}) = ${bal.toString()}`)
    }
    if (balances.length === 0) {
      console.log('No balances to transfer. Exiting.')
      return
    }

    if (args.batch) {
      const idsBn = balances.map((b) => ethers.BigNumber.from(b.id))
      const amtsBn = balances.map((b) => ethers.BigNumber.from(b.amount))
      console.log(`safeBatchTransferFrom(owner -> oapp) ${balances.length} ids...`)
      const tx = await erc1155
        .connect(signer)
        .safeBatchTransferFrom(owner, oapp.address, idsBn, amtsBn, '0x')
      const rc = await tx.wait()
      console.log('✅ batch transfer done, tx:', rc.transactionHash)
    } else {
      for (const b of balances) {
        console.log(`safeTransferFrom(owner -> oapp) id=${b.id}, amount=${b.amount}`)
        const tx = await erc1155
          .connect(signer)
          .safeTransferFrom(owner, oapp.address, b.id, b.amount, '0x')
        const rc = await tx.wait()
        console.log(`  tx: ${rc.transactionHash}`)
      }
      console.log('✅ transfers done')
    }
  })


