use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PlaceLotArgs {
    pub marketplace_index: u64,
    
    pub lot_index: u64,
}

#[derive(Accounts)]
#[instruction(args: PlaceLotArgs)]
pub struct PlaceLot<'info> {
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
}

impl<'info> PlaceLot<'info> {
    fn validate(&self) -> Result<()> {
        let Self {
            lot,
            ..
        } = self;
        
        require!(
            matches!(lot.status, LotStatus::Placed { .. }),
            CustomError::LotIsPlaced,
        );

        require!(
            matches!(lot.status, LotStatus::CancelledByOwner { .. }),
            CustomError::CancelledByOwner
        );

        require!(
            matches!(lot.status, LotStatus::CancelledByMarketplace { .. }),
            CustomError::CancelledByMarketplace,
        );

        require!(
            matches!(lot.status, LotStatus::Sold { .. }),
            CustomError::WasSold,
        );

        Ok(())
    }    

    #[access_control(ctx.accounts.validate())]
    pub fn place_lot(ctx: Context<Self>, args: PlaceLotArgs) -> Result<()> {
        // let lot = &mut ctx.accounts.lot;

        // require!(
        //     lot.status,
        //     LotStatus::Created,
        //     CustomError::LotIsPlaced
        // );


        Ok(())
    }
}