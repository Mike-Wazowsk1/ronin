use crate::*;
use crate::errors::OAppError;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::{get_associated_token_address_with_program_id, create as ata_create, AssociatedToken, Create as AtaCreate};
use anchor_spl::token::{self as spl_token, Token, Transfer};

#[derive(Accounts)]
#[instruction(id32: [u8;32])]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, OnftRegistry>,
    #[account(mut, seeds = [REG_ENTRY_SEED, &id32], bump = entry.bump)]
    pub entry: Account<'info, OnftRegistryEntry>,
    #[account(address = entry.mint)]
    pub mint: AccountInfo<'info>,
    #[account(seeds = [ONFT_SEED], bump = onft_config.bump)]
    pub onft_config: Account<'info, OnftConfig>,
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    #[account(mut)]
    pub dest: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Claim<'info> {
    pub fn apply(ctx: &mut Context<Claim>, _id32: [u8;32]) -> Result<()> {
        // Validate pending in registry entry
        require!(ctx.accounts.entry.pending, OAppError::RegistryEntryNotFound);
        require_keys_eq!(ctx.accounts.entry.pending_to, ctx.accounts.claimant.key(), OAppError::InvalidTokenDestination);

        // Validate escrow/dest ATAs
        let mint = ctx.accounts.entry.mint;
        let expected_escrow = get_associated_token_address_with_program_id(&ctx.accounts.onft_config.key(), &mint, &ctx.accounts.onft_config.token_program);
        require_keys_eq!(ctx.accounts.escrow.key(), expected_escrow, OAppError::InvalidTokenDestination);
        let expected_dest = get_associated_token_address_with_program_id(&ctx.accounts.claimant.key(), &mint, &ctx.accounts.onft_config.token_program);
        require_keys_eq!(ctx.accounts.dest.key(), expected_dest, OAppError::InvalidTokenDestination);

        // Create dest ATA if needed
        if *ctx.accounts.dest.owner != ctx.accounts.token_program.key() {
            ata_create(
                CpiContext::new(
                    ctx.accounts.associated_token_program.to_account_info(),
                    AtaCreate {
                        payer: ctx.accounts.claimant.to_account_info(),
                        associated_token: ctx.accounts.dest.to_account_info(),
                        authority: ctx.accounts.claimant.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                    },
                ),
            )?;
        }

        // Transfer from escrow to claimant signed by onft_config PDA
        let signer_seeds: &[&[u8]] = &[ONFT_SEED, &[ctx.accounts.onft_config.bump]];
        spl_token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.dest.to_account_info(),
                    authority: ctx.accounts.onft_config.to_account_info(),
                },
                &[signer_seeds],
            ),
            ctx.accounts.entry.pending_amount,
        )?;

        // Mark claimed in entry
        ctx.accounts.entry.pending = false;
        Ok(())
    }
}


