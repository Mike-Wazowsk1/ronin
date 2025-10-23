use crate::*;
use anchor_lang::prelude::*;
use oapp::endpoint::{instructions::QuoteParams, state::EndpointSettings, ENDPOINT_SEED, ID as ENDPOINT_ID};

#[derive(Accounts)]
#[instruction(params: QuoteSendOnftParams)]
pub struct QuoteSendOnft<'info> {
    #[account(seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(
        seeds = [PEER_SEED, &store.key().to_bytes(), &params.dst_eid.to_be_bytes()],
        bump = peer.bump
    )]
    pub peer: Account<'info, PeerConfig>,
    #[account(seeds = [ENDPOINT_SEED], bump = endpoint.bump, seeds::program = ENDPOINT_ID)]
    pub endpoint: Account<'info, EndpointSettings>,
}

impl<'info> QuoteSendOnft<'info> {
    pub fn apply(ctx: &Context<QuoteSendOnft>, params: &QuoteSendOnftParams) -> Result<MessagingFee> {
        let message = msg_codec::encode_onft(&params.to, &params.id, params.amount);
        let quote_params = QuoteParams {
            sender: ctx.accounts.store.key(),
            dst_eid: params.dst_eid,
            receiver: ctx.accounts.peer.peer_address,
            message,
            pay_in_lz_token: false,
            options: ctx.accounts.peer.enforced_options.combine_options(&None::<Vec<u8>>, &params.options)?,
        };
        oapp::endpoint_cpi::quote(ENDPOINT_ID, ctx.remaining_accounts, quote_params)
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct QuoteSendOnftParams {
    pub dst_eid: u32,
    pub to: [u8; 32],
    pub id: [u8; 32],
    pub amount: u64,
    pub options: Vec<u8>,
}


