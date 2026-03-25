use anchor_lang::prelude::*;
use anchor_spl::token_interface::{ self, TokenAccount, TokenInterface };

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AttachNftArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub asset: Pubkey
}

#[derive(Accounts)]
#[instruction(args: AttachNftArgs)]
pub struct AttachNft<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            TRANSACTION,
            owner.key().as_ref(),
            LOT,
            &args.lot_index.to_le_bytes(),
        ],
        bump  = lot.bump,
    )]
    pub lot: Account<'info, Lot>,

    #[account(
        seeds = [
            PROGRAM_PREFIX,
            program_config.marketplace_deploy_authority.key().as_ref(),
            MARKETPLACE,
            &args.marketplace_index.to_le_bytes(),
        ],
        bump  = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        seeds = [PROGRAM_PREFIX, PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(
        constraint = nft_token_account.mint == args.asset
            @ CustomError::InvalidAsset,
        constraint = nft_token_account.owner == owner.key()
            @ CustomError::NotNftOwner,
        constraint = nft_token_account.amount == 1
            @ CustomError::InvalidAsset,
    )]
    pub nft_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> AttachNft<'info> {
    pub fn attach_nft(ctx: Context<Self>, args: AttachNftArgs) -> Result<()> {
        let lot = &mut ctx.accounts.lot;

        lot.asset = args.asset;

        Ok(())
    }
}