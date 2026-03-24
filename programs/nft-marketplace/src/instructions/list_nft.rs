use anchor_lang::prelude::*;
use mpl_core::{
    programs,
    instructions::TransferV1CpiBuilder,
};

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ListNftArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub salesperson: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: ListNftArgs)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ CustomError::Unauthorized,
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

    // For Metaplex CPI
    pub system_program: Program<'info, System>,

    /// CHECK: Asset Account
    #[account(mut, address = lot.asset)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: MPL Core Program
    #[account(address = programs::MPL_CORE_ID)]
    pub core_program: UncheckedAccount<'info>,
}

impl<'info> ListNft<'info> {
    fn validate(&self) -> Result<()> {
        let Self {
            lot,
            ..
        } = self;

        require!(
            !lot.is_listed,
            CustomError::AlreadyListed,
        );

        require!(
            matches!(lot.status, LotStatus::Created { .. }),
            CustomError::UnavailableForSale,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn list_nft(ctx: Context<Self>, args: ListNftArgs) -> Result<()> {
        ctx.accounts.lot.is_listed = true;

        let list = &ctx.accounts;

        TransferV1CpiBuilder::new(&list.core_program.to_account_info())
            .asset(&list.asset.to_account_info())
            .payer(&list.owner.to_account_info())
            .authority(Some(&list.owner.to_account_info()))
            .new_owner(&list.lot.to_account_info())
            .system_program(Some(&list.system_program.to_account_info()))
            .invoke()?;

        Ok(())
    }
}