use crate::*;
use anchor_lang::prelude::*;
use crate::errors::OAppError;
use anchor_spl::{
    associated_token::{get_associated_token_address_with_program_id, AssociatedToken},
};

#[derive(Accounts)]
#[instruction(token_mint: Pubkey)]
pub struct InitOnftAdapter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    pub token_program: AccountInfo<'info>,
    #[account(address = token_mint)]
    pub mint: AccountInfo<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + OnftConfig::INIT_SPACE,
        seeds = [ONFT_SEED],
        bump
    )]
    pub onft_config: Account<'info, OnftConfig>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitOnftAdapter<'info> {
    pub fn apply(ctx: &mut Context<InitOnftAdapter>, token_mint: Pubkey) -> Result<()> {
        // Enforce admin only: payer must be current store admin
        require_keys_eq!(ctx.accounts.payer.key(), ctx.accounts.store.admin, OAppError::InvalidTokenDestination);
        let bump = ctx.bumps.onft_config;
        let onft = &mut ctx.accounts.onft_config;
        onft.admin = ctx.accounts.store.admin;
        onft.token_mint = token_mint;
        onft.token_program = ctx.accounts.token_program.key();
        // Derive escrow ATA address for OnftConfig PDA now (created off-chain when needed)
        let escrow = get_associated_token_address_with_program_id(
            &onft.key(),
            &onft.token_mint,
            &onft.token_program,
        );
        onft.escrow = escrow;
        onft.bump = bump;
        Ok(())
    }
}


