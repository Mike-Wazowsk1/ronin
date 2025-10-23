use crate::*;
use oapp::endpoint_cpi::{get_accounts_for_clear, LzAccount};
use oapp::{endpoint::ID as ENDPOINT_ID, LzReceiveParams};
use anchor_lang::solana_program;

/// Returns all accounts used by `lz_receive` and `Endpoint::clear` in required order.
#[derive(Accounts)]
pub struct LzReceiveTypes<'info> {
    #[account(seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
}

impl LzReceiveTypes<'_> {
    pub fn apply(
        ctx: &Context<LzReceiveTypes>,
        params: &LzReceiveParams,
    ) -> Result<Vec<LzAccount>> {
        let store = ctx.accounts.store.key();
        // If payload is ONFT, include the registry entry PDA to be written
        let payload = msg_codec::decode_onft(&params.message).ok();
        // Return store and system_program first so they map correctly to `LzReceive` accounts.
        let mut accounts = vec![
            LzAccount { pubkey: store, is_signer: false, is_writable: true },
            LzAccount { pubkey: solana_program::system_program::ID, is_signer: false, is_writable: false },
        ];
        if let Some(onft) = payload {
            // Include registry entry to write pending info
            let (entry, _) = Pubkey::find_program_address(&[REG_ENTRY_SEED, &onft.id], ctx.program_id);
            accounts.push(LzAccount { pubkey: entry, is_signer: false, is_writable: true });
        }
        // Append Endpoint::clear accounts at the tail
        let accounts_for_clear = get_accounts_for_clear(ENDPOINT_ID, &store, params.src_eid, &params.sender, params.nonce);
        accounts.extend(accounts_for_clear);
        Ok(accounts)
    }
}
