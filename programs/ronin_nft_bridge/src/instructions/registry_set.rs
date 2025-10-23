use crate::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id32: [u8;32])]
pub struct SetRegistryEntry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump, constraint = store.admin == admin.key())]
    pub store: Account<'info, Store>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, OnftRegistry>,
    /// CHECK: read-only mint pubkey is passed via param to validate against created entry later
    pub mint: AccountInfo<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + OnftRegistryEntry::INIT_SPACE,
        seeds = [REG_ENTRY_SEED, &id32],
        bump
    )]
    pub entry: Account<'info, OnftRegistryEntry>,
    pub system_program: Program<'info, System>,
}

impl<'info> SetRegistryEntry<'info> {
    pub fn apply(ctx: &mut Context<SetRegistryEntry>, id32: [u8;32]) -> Result<()> {
        ctx.accounts.entry.id32 = id32;
        ctx.accounts.entry.mint = ctx.accounts.mint.key();
        ctx.accounts.entry.bump = ctx.bumps.entry;
        Ok(())
    }
}


