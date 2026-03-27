use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LotCreateArgs {
    pub marketplace_index: u64,

    pub asset: Pubkey,
 
    pub currency: Option<Pubkey>,

    pub price: u64,
}

#[derive(Accounts)]
#[instruction(args: LotCreateArgs)]
pub struct LotCreate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Lot::INIT_SPACE,
        seeds = [
            PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            TRANSACTION,
            owner.key().as_ref(),
            LOT,
            &marketplace.transaction_index.to_le_bytes(),
        ],
        bump,
    )]
    pub lot: Account<'info, Lot>,

    #[account(
        mut,
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

    pub system_program: Program<'info, System>,
}

impl<'info> LotCreate<'info> {
    pub fn lot_create(ctx: Context<Self>, args: LotCreateArgs) -> Result<()> {
        let lot = &mut ctx.accounts.lot;

        #[cfg(not(feature = "refactor"))]
        {
            lot.status = LotStatus::Created {
                timestamp: Clock::get()?.unix_timestamp,
            };

            lot.marketplace = ctx.accounts.marketplace.key();
            lot.owner = ctx.accounts.owner.key();
            
            // lot.asset = args.asset;
            lot.currency = args.currency;
            lot.price = args.price;

            lot.is_listed = false;

            lot.bump = ctx.bumps.lot;

            ctx.accounts.marketplace.transaction_index =
            ctx.accounts.marketplace.transaction_index.checked_add(1).ok_or(
                CustomError::Overflow,
            )?;
        }

        let marketplace = ctx.accounts.marketplace.key();            
        let owner = ctx.accounts.owner.key();

        let asset = args.asset.key();
        let currency = None;

        let price = args.price;
        let status = LotStatus::Created {
            timestamp: Clock::get()?.unix_timestamp,
        };
  
        let is_listed = false;
        let  bump = ctx.bumps.lot;

        ctx.accounts.lot.set_inner(Lot {
            marketplace,
            owner,
            asset,
            currency,
            price,
            status,
            is_listed,
            bump,
        });

        Ok(())
    }
}
