use crate::*;
use anchor_lang::prelude::*;
use crate::errors::OAppError;

#[derive(Accounts)]
pub struct InitRegistry<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(
        init,
        payer = payer,
        space = 8 + OnftRegistry::INIT_SPACE,
        seeds = [REGISTRY_SEED],
        bump
    )]
    pub registry: Account<'info, OnftRegistry>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitRegistry<'info> {
    pub fn apply(ctx: &mut Context<InitRegistry>) -> Result<()> {
        // Enforce admin only: payer must be current store admin
        require_keys_eq!(ctx.accounts.payer.key(), ctx.accounts.store.admin, OAppError::InvalidTokenDestination);
        ctx.accounts.registry.admin = ctx.accounts.store.admin;
        ctx.accounts.registry.bump = ctx.bumps.registry;
        Ok(())
    }
}


