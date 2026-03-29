use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::{
    program,
    system_instruction,
    native_token::LAMPORTS_PER_SOL,
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
            SEED_PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            SEED_TRANSACTION,
            &args.salesperson.key().as_ref(),
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
        has_one = treasury,
        seeds = [SEED_PROGRAM_PREFIX, SEED_PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    /// CHECK: For transaction fee collecting
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

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

        let buy_fee = ctx.accounts.marketplace.transaction_fee;
        let seller_amount = ctx.accounts.lot.price.checked_sub(buy_fee).ok_or(
            CustomError::NotEnoughMoney,
        )?;

        #[cfg(feature = "testing")]
        {
            program::invoke(
                &system_instruction::transfer(
                    ctx.accounts.buyer.key,
                    ctx.accounts.salesperson.key,
                    seller_amount,
                ),
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.salesperson.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }
        #[cfg(not(feature = "testing"))]
        {
            let context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to:   ctx.accounts.salesperson.to_account_info(),

                },
            );

            system_program::transfer(
                context,
                seller_amount,
            )?;
        }

        let marketplace_key = ctx.accounts.marketplace.key();
        let salesperson_key = args.salesperson.key();
        let lot_index_bytes = args.lot_index.to_le_bytes();
        let lot_bump        = ctx.accounts.lot.bump;

        let lot_seeds: &[&[u8]] = &[
            SEED_PROGRAM_PREFIX,
            marketplace_key.as_ref(),
            SEED_TRANSACTION,
            salesperson_key.as_ref(),
            SEED_LOT,
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

            if buy_fee > 0 {
                let context = CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to:   ctx.accounts.treasury.to_account_info(),
                    },
                );

                system_program::transfer(
                    context,
                    buy_fee,
                )?;

                msg!("Buy fee: {}\n", buy_fee / LAMPORTS_PER_SOL);
            }

        }
        #[cfg(feature = "testing")]
        {
            msg!("Skipping Metaplex Core CPI in testing mode");
        }

        Ok(())
    }
}