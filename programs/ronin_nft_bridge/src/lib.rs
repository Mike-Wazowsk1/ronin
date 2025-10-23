mod errors;
mod instructions;
mod msg_codec;
mod state;

use anchor_lang::prelude::*;
use instructions::*;
use oapp::{endpoint::MessagingFee, endpoint_cpi::LzAccount, LzReceiveParams};
use solana_helper::program_id_from_env;
use state::*;

declare_id!(anchor_lang::solana_program::pubkey::Pubkey::new_from_array(program_id_from_env!(
    "RONIN_NFT_BRIDGE_ID",
    "ApfDneee1WoxEEDK2vTxgUeD7FNwmg1Xw6Hn7eBHMwcS"
)));

const LZ_RECEIVE_TYPES_SEED: &[u8] = b"LzReceiveTypes"; // Required seed used by Executor
const STORE_SEED: &[u8] = b"Store";
const PEER_SEED: &[u8] = b"Peer"; // Not used by Executor

#[program]
pub mod ronin_nft_bridge {
    use super::*;

    // Initializers
    pub fn init_store(mut ctx: Context<InitStore>, params: InitStoreParams) -> Result<()> {
        InitStore::apply(&mut ctx, &params)
    }

    // Admin
    pub fn set_peer_config(
        mut ctx: Context<SetPeerConfig>,
        params: SetPeerConfigParams,
    ) -> Result<()> {
        SetPeerConfig::apply(&mut ctx, &params)
    }

    // Public
    pub fn quote_send(ctx: Context<QuoteSend>, params: QuoteSendParams) -> Result<MessagingFee> {
        QuoteSend::apply(&ctx, &params)
    }

    pub fn send(mut ctx: Context<Send>, params: SendMessageParams) -> Result<()> {
        Send::apply(&mut ctx, &params)
    }

    // Handle incoming cross-chain messages
    pub fn lz_receive(mut ctx: Context<LzReceive>, params: LzReceiveParams) -> Result<()> {
        LzReceive::apply(&mut ctx, &params)
    }

    // Return the list of accounts required to execute lz_receive
    pub fn lz_receive_types(
        ctx: Context<LzReceiveTypes>,
        params: LzReceiveParams,
    ) -> Result<Vec<LzAccount>> {
        LzReceiveTypes::apply(&ctx, &params)
    }

    // ONFT Adapter (Solana)
    pub fn init_onft_adapter(mut ctx: Context<InitOnftAdapter>, token_mint: Pubkey) -> Result<()> {
        InitOnftAdapter::apply(&mut ctx, token_mint)
    }

    pub fn send_onft(mut ctx: Context<SendOnft>, params: SendOnftParams) -> Result<oapp::endpoint::MessagingReceipt> {
        SendOnft::apply(&mut ctx, &params)
    }

    pub fn quote_send_onft(ctx: Context<QuoteSendOnft>, params: QuoteSendOnftParams) -> Result<MessagingFee> {
        QuoteSendOnft::apply(&ctx, &params)
    }

    // ONFT Registry
    pub fn init_registry(mut ctx: Context<InitRegistry>) -> Result<()> {
        InitRegistry::apply(&mut ctx)
    }

    pub fn set_registry_entry(mut ctx: Context<SetRegistryEntry>, id32: [u8; 32]) -> Result<()> {
        SetRegistryEntry::apply(&mut ctx, id32)
    }

    // Claims
    pub fn claim(mut ctx: Context<Claim>, id32: [u8; 32]) -> Result<()> {
        Claim::apply(&mut ctx, id32)
    }

    
}
