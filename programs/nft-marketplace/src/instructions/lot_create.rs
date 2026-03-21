use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LotCreateArgs {
    pub marketplace_index: u64,

    pub mint: Pubkey,
 
    pub currency: Pubkey,

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

        lot.marketplace = ctx.accounts.marketplace.key();
        lot.owner    = ctx.accounts.owner.key();
        
        lot.mint     = args.mint;
        lot.currency = args.currency;
        lot.price    = args.price;

        lot.bump     = ctx.bumps.lot;

        ctx.accounts.marketplace.transaction_index =
        ctx.accounts.marketplace.transaction_index.checked_add(1).ok_or(
            CustomError::Overflow,
        )?;

        Ok(())
    }
}
