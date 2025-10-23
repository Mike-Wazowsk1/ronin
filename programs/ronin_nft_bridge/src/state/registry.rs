use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct OnftRegistry {
    pub admin: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OnftRegistryEntry {
    pub id32: [u8; 32],
    pub mint: Pubkey,
    pub pending_to: Pubkey,
    pub pending_amount: u64,
    pub pending: bool,
    pub bump: u8,
}

pub const REGISTRY_SEED: &[u8] = b"ONFT_REG";
pub const REG_ENTRY_SEED: &[u8] = b"ONFT_REG_ENTRY";


