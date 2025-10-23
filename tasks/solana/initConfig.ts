import { PublicKey } from '@solana/web3.js'
import { ConfigurableTaskDefinition } from 'hardhat/types'

import { inheritTask } from '@layerzerolabs/devtools-evm-hardhat'
import { type LogLevel } from '@layerzerolabs/io-devtools'
import { type OAppConfigurator } from '@layerzerolabs/ua-devtools'
import { TASK_LZ_OAPP_WIRE } from '@layerzerolabs/ua-devtools-evm-hardhat'

import { initOAppAccounts, initSolanaLibs } from '../../lib/config'

// We'll create clones of the wire task and only override the configurator argument
const wireLikeTask = inheritTask(TASK_LZ_OAPP_WIRE)

// TODO: export from wire.ts instead of re-declaring
/**
 * Additional CLI arguments for our custom wire task
 */
interface Args {
    logLevel: LogLevel
    multisigKey?: PublicKey
    internalConfigurator?: OAppConfigurator
}

// This task will use the `initOFTAccounts` configurator that initializes the Solana accounts
const initConfigTask = wireLikeTask('lz:oapp:solana:init-config') as ConfigurableTaskDefinition

// TODO: currently the message for 'already done' state is "OApp is already wired." which is misleading -> should be changed to "Pathway Config already initialized"
initConfigTask
    .setDescription('Initialize OApp accounts for Solana (ULN send/receive libs and OApp config on testnet)')
    .setAction(async (args: Args, hre) =>
        hre.run(TASK_LZ_OAPP_WIRE, {
            ...args,
            // сначала инициализируем ULN библиотеки и OApp config, затем стандартные аккаунты
            // обязательно вернуть объединённый массив транзакций
            internalConfigurator: async (...cfgArgs) => {
                const txsA = (await initSolanaLibs(...cfgArgs)) ?? []
                const txsB = (await initOAppAccounts(...cfgArgs)) ?? []
                return [...txsA, ...txsB]
            },
            isSolanaInitConfig: true,
        })
    )
