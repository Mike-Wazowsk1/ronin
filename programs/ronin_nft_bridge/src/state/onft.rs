use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct OnftConfig {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub token_program: Pubkey,
    pub escrow: Pubkey,
    pub bump: u8,
}

pub const ONFT_SEED: &[u8] = b"ONFT";


