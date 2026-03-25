use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program,
    system_instruction,
};

use mpl_core::{ 
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

    /// CHECK: Lot owner, gets money
    #[account(mut, address = lot.owner)]
    pub salesperson: UncheckedAccount<'info>,

    /// CHECK: Account of asset that containing inside the lot 
    #[account(mut, address = lot.asset)]
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

        program::invoke(
            &system_instruction::transfer(
                ctx.accounts.buyer.key,
                ctx.accounts.salesperson.key,
                ctx.accounts.lot.price,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.salesperson.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

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

        #[cfg(not(feature = "testing"))]
        {
            TransferV1CpiBuilder::new(&ctx.accounts.core_program.to_account_info())
                .asset(&ctx.accounts.asset.to_account_info())
                .payer(&ctx.accounts.buyer.to_account_info())
                .authority(Some(&ctx.accounts.lot.to_account_info()))
                .new_owner(&ctx.accounts.buyer.to_account_info())
                .system_program(Some(&ctx.accounts.system_program.to_account_info()))
                .invoke_signed(&[lot_seeds])?;
        }
        #[cfg(feature = "testing")]
        {
            msg!("Skipping Metaplex Core CPI in testing mode");
        }

        Ok(())
    }
}