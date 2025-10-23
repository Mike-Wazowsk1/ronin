import { task } from 'hardhat/config'
import { createLogger } from '@layerzerolabs/io-devtools'
import { execSync } from 'node:child_process'

// Minimal watcher: requires you to provide parsed fields manually or integrate with your event source.
// For production, replace this with a proper listener for your EVM ONFT Sent event and decode payload.

// Usage example:
// npx hardhat evm:watchOnft --eid 40168 --id <hex32> --to <SOL_PUBKEY> --amount <u64>

task('evm:watchOnft', 'Trigger solana:initPending for a received ONFT payload')
  .addParam('eid', 'Solana EndpointId (e.g. 40168 for Devnet)')
  .addParam('id', '32-byte hex token id (without 0x)')
  .addParam('to', 'Solana recipient pubkey (base58)')
  .addParam('amount', 'Amount (u64)')
  .setAction(async (args) => {
    const logger = createLogger()
    const { eid, id, to, amount } = args
    const cmd = `npx hardhat solana:initPending --eid ${eid} --id ${id} --to ${to} --amount ${amount}`
    logger.info(`Running: ${cmd}`)
    try {
      const out = execSync(cmd, { stdio: 'inherit' })
      logger.info('initPending completed')
    } catch (e) {
      logger.error('initPending failed', e)
      process.exit(1)
    }
  })
