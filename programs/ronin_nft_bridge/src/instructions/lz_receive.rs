use crate::*;
use crate::errors::OAppError;
use anchor_lang::prelude::*;
// No Rent/system_instruction needed in registry-pending model
use anchor_lang::{AnchorDeserialize, AnchorSerialize, Discriminator};
// No token CPIs in this stage
use oapp::{endpoint::ID as ENDPOINT_ID, LzReceiveParams};
use oapp::endpoint::cpi::accounts::Clear;
use oapp::endpoint::instructions::ClearParams;
use oapp::endpoint::ConstructCPIContext;

// Passthrough mode: accept messages without touching tokens
const RECEIVE_PASSTHROUGH: bool = true;

fn bytes_to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

#[derive(Accounts)]
#[instruction(params: LzReceiveParams)]
pub struct LzReceive<'info> {
    #[account(mut, seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    pub system_program: Program<'info, System>,
}

impl<'info> LzReceive<'info> {
    pub fn apply(ctx: &mut Context<LzReceive>, params: &LzReceiveParams) -> Result<()> {
        // Split remaining_accounts: clear accounts must be at the tail; call clear first, then use business accounts
        let ra = &ctx.remaining_accounts;
        let min_clear = Clear::MIN_ACCOUNTS_LEN;
        require!(ra.len() >= min_clear, OAppError::InvalidMessageType);
        let clear_start = ra.len() - min_clear;
        {
            let accounts_for_clear = &ra[clear_start..];
            let seeds: &[&[u8]] = &[STORE_SEED, &[ctx.accounts.store.bump]];
            let _ = oapp::endpoint_cpi::clear(
                ENDPOINT_ID,
                ctx.accounts.store.key(),
                accounts_for_clear,
                seeds,
                ClearParams {
                    receiver: ctx.accounts.store.key(),
                    src_eid: params.src_eid,
                    sender: params.sender,
                    nonce: params.nonce,
                    guid: params.guid,
                    message: params.message.clone(),
                },
            )?;
        }

        // ONFT handling: locate registry entry account and update pending fields
        if let Ok(onft) = msg_codec::decode_onft(&params.message) {
            let biz_accounts = &ctx.remaining_accounts[..clear_start];
            // New model: persist pending state in OnftRegistryEntry (no new accounts created)
            let (entry_key, _) = Pubkey::find_program_address(&[REG_ENTRY_SEED, &onft.id], ctx.program_id);
            let entry_ai_opt = biz_accounts.iter().find(|ai| ai.key() == entry_key);
            let mut result_note = String::from("missing_entry");
            if let Some(entry_ai) = entry_ai_opt {
                if entry_ai.is_writable {
                    // Deserialize (skip discriminator), modify, serialize back
                    let data = entry_ai.try_borrow_data()?;
                    let mut rd: &[u8] = &data[8..];
                    let mut entry: OnftRegistryEntry = AnchorDeserialize::deserialize(&mut rd)?;
                    drop(rd);
                    drop(data);

                    entry.pending_to = Pubkey::new_from_array(onft.to);
                    entry.pending_amount = onft.amount;
                    entry.pending = true;

                    let mut buf: Vec<u8> = Vec::new();
                    buf.extend_from_slice(&OnftRegistryEntry::discriminator());
                    entry.serialize(&mut buf)?;
                    let mut wr = entry_ai.try_borrow_mut_data()?;
                    require!(wr.len() >= buf.len(), OAppError::InvalidMessageType);
                    wr[..buf.len()].copy_from_slice(&buf);

                    result_note = String::from("entry_pending_set");
                } else {
                    result_note = String::from("entry_not_writable");
                }
            }
            let to_hex = bytes_to_hex(&onft.to);
            let id_hex = bytes_to_hex(&onft.id);
            ctx.accounts.store.string = format!("ONFT pending: to=0x{} id=0x{} amount={} init={}", to_hex, id_hex, onft.amount, result_note);
        } else {
            let string_value = msg_codec::decode(&params.message)?;
            ctx.accounts.store.string = string_value;
        }

        Ok(())
    }
}

