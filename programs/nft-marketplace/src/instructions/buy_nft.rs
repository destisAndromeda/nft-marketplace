use anchor_lang::prelude::*;
use mpl_core::{ 
    // self,
    instructions::TransferV1CpiBuilder,
    programs,
};

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct BuyNftArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub salesperson: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: BuyNftArgs)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            TRANSACTION,
            &args.salesperson.key().as_ref(),
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

    /// CHECK: Account of asset that containing inside the lot 
    #[account(mut, address = programs::MPL_CORE_ID)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: mpl_core program
    #[account(address = programs::MPL_CORE_ID)]
    pub core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> BuyNft<'info> {
    fn validate(&self) -> Result<()> {
        let Self {
            lot,
            ..
        } = self;

        require!(
            lot.is_listed,
            CustomError::NotYetListed,
        );

        require!(
            matches!(lot.status, LotStatus::AvailableForSale { .. }),
            CustomError::UnavailableForSale,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn buy_nft(ctx: Context<Self>, args: BuyNftArgs) -> Result<()> {
        ctx.accounts.lot.status = LotStatus::Sold {
            timestamp: Clock::get()?.unix_timestamp,
        };

        let marketplace_key = ctx.accounts.marketplace.key();
        let salesperson_key = args.salesperson.key();
        let lot_index_bytes = args.lot_index.to_le_bytes();
        let lot_bump        = ctx.accounts.lot.bump;

        let lot_seeds: &[&[u8]] = &[
            PROGRAM_PREFIX,
            marketplace_key.as_ref(),
            TRANSACTION,
            salesperson_key.as_ref(),
            LOT,
            &lot_index_bytes,
            &[lot_bump]
        ];

        let list = ctx.accounts;

        TransferV1CpiBuilder::new(&list.core_program.to_account_info())
            .asset(&list.asset.to_account_info())
            .payer(&list.buyer.to_account_info())
            .authority(Some(&list.lot.to_account_info()))
            .new_owner(&list.buyer.to_account_info())
            .system_program(Some(&list.system_program.to_account_info()))
            .invoke_signed(&[lot_seeds])?;

        Ok(())
    }
}