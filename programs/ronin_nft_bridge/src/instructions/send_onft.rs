use crate::*;
use crate::errors::OAppError;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{create as ata_create, get_associated_token_address_with_program_id, AssociatedToken, Create as AtaCreate},
    token::{self, Token, Transfer},
};
use oapp::endpoint::{instructions::SendParams, MessagingReceipt, ID as ENDPOINT_ID};

#[derive(Accounts)]
#[instruction(params: SendOnftParams)]
pub struct SendOnft<'info> {
    pub signer: Signer<'info>,
    #[account(
        seeds = [PEER_SEED, &store.key().to_bytes(), &params.dst_eid.to_be_bytes()],
        bump = peer.bump
    )]
    pub peer: Account<'info, PeerConfig>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(mut)]
    pub mint: AccountInfo<'info>,
    #[account(seeds = [ONFT_SEED], bump = onft_config.bump)]
    pub onft_config: Account<'info, OnftConfig>,
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, OnftRegistry>,
    pub registry_entry: Account<'info, OnftRegistryEntry>,
    #[account(mut)]
    pub user_token: AccountInfo<'info>,
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> SendOnft<'info> {
    pub fn apply(ctx: &mut Context<SendOnft>, params: &SendOnftParams) -> Result<MessagingReceipt> {
        // Validate registry entry for id -> mint
        let (expected_entry, _bump) = Pubkey::find_program_address(&[REG_ENTRY_SEED, &params.id], ctx.program_id);
        require_keys_eq!(ctx.accounts.registry_entry.key(), expected_entry, OAppError::RegistryEntryNotFound);
        require_keys_eq!(ctx.accounts.mint.key(), ctx.accounts.registry_entry.mint, OAppError::RegistryMintMismatch);

        // Lock: transfer from user to escrow; create escrow ATA if needed
        if *ctx.accounts.escrow.owner != ctx.accounts.token_program.key() {
            let expected_ata = get_associated_token_address_with_program_id(
                &ctx.accounts.onft_config.key(),
                &ctx.accounts.mint.key(),
                &ctx.accounts.onft_config.token_program,
            );
            require_keys_eq!(ctx.accounts.escrow.key(), expected_ata, OAppError::InvalidTokenDestination);
            ata_create(
                CpiContext::new(
                    ctx.accounts.associated_token_program.to_account_info(),
                    AtaCreate {
                        payer: ctx.accounts.signer.to_account_info(),
                        associated_token: ctx.accounts.escrow.to_account_info(),
                        authority: ctx.accounts.onft_config.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                    },
                ),
            )?;
        }

        let expected_user_ata = get_associated_token_address_with_program_id(
            &ctx.accounts.signer.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.onft_config.token_program,
        );
        require_keys_eq!(ctx.accounts.user_token.key(), expected_user_ata, OAppError::InvalidTokenDestination);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            ),
            params.amount,
        )?;

        // Send Endpoint message
        let seeds: &[&[u8]] = &[STORE_SEED, &[ctx.accounts.store.bump]];
        let payload = msg_codec::encode_onft(&params.to, &params.id, params.amount);
        let options = ctx
            .accounts
            .peer
            .enforced_options
            .combine_options(&None::<Vec<u8>>, &params.options)?;
        let sp = SendParams {
            dst_eid: params.dst_eid,
            receiver: ctx.accounts.peer.peer_address,
            message: payload,
            options,
            native_fee: params.native_fee,
            lz_token_fee: params.lz_token_fee,
        };
        let receipt = oapp::endpoint_cpi::send(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            seeds,
            sp,
        )?;
        Ok(receipt)
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SendOnftParams {
    pub dst_eid: u32,
    pub to: [u8; 32],
    pub id: [u8; 32],
    pub amount: u64,
    pub options: Vec<u8>,
    pub native_fee: u64,
    pub lz_token_fee: u64,
}


