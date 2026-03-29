use anchor_lang::prelude::*;

use mpl_core::{
    instructions::TransferV1CpiBuilder,
    programs,
};

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CancelByMarketplaceArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub lot_owner: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: CancelByMarketplaceArgs)]
pub struct CancelByMarketplace<'info> {
    // Looks like i need this for cancel only
    pub local_admin: Signer<'info>,

    #[account(
        mut,
        has_one = asset
            @ CustomError::InvalidAsset,
        seeds = [
            SEED_PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            SEED_TRANSACTION,
            args.lot_owner.as_ref(),
            SEED_LOT,
            &args.lot_index.to_le_bytes(),
        ],
        bump  = lot.bump,
    )]
    pub lot: Account<'info, Lot>,

    #[account(
        has_one = local_admin 
            @ CustomError::Unauthorized,
        seeds = [
            SEED_PROGRAM_PREFIX,
            program_config.marketplace_deploy_authority.key().as_ref(),
            SEED_MARKETPLACE,
            &args.marketplace_index.to_le_bytes(),
        ],
        bump  = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        seeds = [SEED_PROGRAM_PREFIX, SEED_PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    /// CHECK: Asset connected to the lot
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: Source owner of asset
    #[account(mut)]
    pub source_owner: UncheckedAccount<'info>,

    /// CHECK: MPL Core Program
    #[account(address = programs::MPL_CORE_ID)]
    pub core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CancelByMarketplace<'info> {
    fn validate(&self) -> Result<()> {
        let Self {
            lot,
            ..
        } = self;

        require!(
            !matches!(lot.status, LotStatus::CancelledByMarketplace { .. }),
            CustomError::AlreadyCancelled,
        );

        require!(
            !matches!(lot.status, LotStatus::CancelledByOwner { .. }),
            CustomError::AlreadyCancelled,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn cancel_by_marketplace(ctx: Context<Self>, args: CancelByMarketplaceArgs) -> Result<()> {
        ctx.accounts.lot.status = LotStatus::CancelledByMarketplace {
            timestamp: Clock::get()?.unix_timestamp,
        };

        let marketplace_key = ctx.accounts.marketplace.key();
        let owner_key       = args.lot_owner.key();
        let lot_index_bytes = args.lot_index.to_le_bytes();
        let lot_bump        = ctx.accounts.lot.bump;

        let lot_seeds: &[&[u8]] = &[
            SEED_PROGRAM_PREFIX,
            marketplace_key.as_ref(),
            SEED_TRANSACTION,
            owner_key.as_ref(),
            SEED_LOT,
            &lot_index_bytes,
            &[lot_bump],
        ];

        #[cfg(not(feature = "testing"))]
        {
            TransferV1CpiBuilder::new(&ctx.accounts.core_program.to_account_info())
                .asset(&ctx.accounts.asset.to_account_info())
                .payer(&ctx.accounts.local_admin.to_account_info())
                .authority(Some(&ctx.accounts.lot.to_account_info()))
                .new_owner(&ctx.accounts.source_owner.to_account_info())
                .system_program(Some(&ctx.accounts.system_program.to_account_info()))
                .invoke_signed(&[lot_seeds])?;
        }
        #[cfg(feature = "testing")]
        {
            msg!("Skip CPI to metaplex");
        }

        Ok(())
    }
}