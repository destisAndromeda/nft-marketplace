use anchor_lang::prelude::*;

use mpl_core::{
    instructions::TransferV1CpiBuilder,
    programs,
};

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CancelByOwnerArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,
}

#[derive(Accounts)]
#[instruction(args: CancelByOwnerArgs)]
pub struct CancelByOwner<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner
            @ CustomError::Unauthorized,
        seeds = [
            SEED_PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            SEED_TRANSACTION,
            owner.key().as_ref(),
            SEED_LOT,
            &args.lot_index.to_le_bytes(),
        ],
        bump  = lot.bump,
    )]
    pub lot: Account<'info, Lot>,

    #[account(
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

    /// CHECK: Lot asset account for refund
    #[account(address = lot.asset)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: MPL Core Program
    #[account(address = programs::MPL_CORE_ID)]
    pub core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CancelByOwner<'info> {
    fn validate(&self) -> Result<()> {
        let Self {
            lot,
            ..
        } = self;

        require!(
            !matches!(lot.status, LotStatus::CancelledByOwner { .. }),
            CustomError::AlreadyCancelled,
        );

        require!(
            !matches!(lot.status, LotStatus::CancelledByMarketplace { .. }),
            CustomError::AlreadyCancelled,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn cancel_by_owner(ctx: Context<Self>, args: CancelByOwnerArgs) -> Result<()> {
        let lot = &mut ctx.accounts.lot;

        lot.status = LotStatus::CancelledByOwner {
            timestamp: Clock::get()?.unix_timestamp,
        };

        let marketplace_key = ctx.accounts.marketplace.key();
        let owner_key       = ctx.accounts.lot.owner.key();
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
                .payer(&ctx.accounts.owner.to_account_info())
                .authority(Some(&ctx.accounts.lot.to_account_info()))
                .new_owner(&ctx.accounts.owner.to_account_info())
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