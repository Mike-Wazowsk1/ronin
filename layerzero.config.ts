import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import * as metadataTools from '@layerzerolabs/metadata-tools'
import { TwoWayConfig } from '@layerzerolabs/metadata-tools'
const generateConnectionsConfig = metadataTools.generateConnectionsConfig
const { NIL_BLOCK_CONFIRMATIONS } = metadataTools as any
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import { getSolanaOAppAddress } from './tasks/solana'

const sepoliaContract: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'RoninNftBridge',
}

const optimismContract: OmniPointHardhat = {
    eid: EndpointId.OPTSEP_V2_TESTNET,
    contractName: 'RoninNftBridge',
}

const solanaContract: OmniPointHardhat = {
    eid: EndpointId.SOLANA_V2_TESTNET,
    address: getSolanaOAppAddress(EndpointId.SOLANA_V2_TESTNET), // NOTE: replace with the oapp account address
}

// For this example's simplicity, we will use the same enforced options values for sending to all chains
// For production, you should ensure `gas` is set to the correct value through profiling the gas usage of calling OApp._lzReceive(...) on the destination chain
// To learn more, read https://docs.layerzero.network/v2/concepts/applications/oapp-standard#execution-options-and-enforced-settings
const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 100_000,
    },
]

const SOLANA_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 100_000,
    },
]

// To connect all the above chains to each other, we need the following pathways:
// Sepolia <-> Solana, Optimism <-> Solana, and Sepolia <-> Optimism

// With the config generator, pathways declared are automatically bidirectional
// i.e. if you declare A,B there's no need to declare B,A
const pathways: TwoWayConfig[] = [
    // Sepolia <-> Solana
    [
        sepoliaContract,
        solanaContract,
        [
            [],
            [['LayerZero Labs'], 1],
        ],
        [NIL_BLOCK_CONFIRMATIONS ?? 15, NIL_BLOCK_CONFIRMATIONS ?? 32],
        [SOLANA_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    ],
    // Optimism <-> Solana
    [
        optimismContract,
        solanaContract,
        [
            [],
            [['LayerZero Labs'], 1],
        ],
        [NIL_BLOCK_CONFIRMATIONS ?? 15, NIL_BLOCK_CONFIRMATIONS ?? 32],
        [SOLANA_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    ],
    // Sepolia <-> Optimism
    [
        sepoliaContract,
        optimismContract,
        [
            [],
            [['LayerZero Labs'], 1],
        ],
        [NIL_BLOCK_CONFIRMATIONS ?? 15, NIL_BLOCK_CONFIRMATIONS ?? 15],
        [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    ],
]

export default async function () {
    // Generate the connections config based on the pathways
    const connections = await generateConnectionsConfig(pathways)
    return {
        contracts: [{ contract: sepoliaContract }, { contract: optimismContract }, { contract: solanaContract }],
        connections,
    }
}
