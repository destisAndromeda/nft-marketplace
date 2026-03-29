use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MarketplaceCreateArgs {
    pub local_admin: Pubkey,

    pub transaction_fee: u64,
}

#[derive(Accounts)]
pub struct MarketplaceCreate<'info> {
    #[account(
        mut,
        address = program_config.marketplace_deploy_authority @
            CustomError::Unauthorized,
    )]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [
            SEED_PROGRAM_PREFIX,
            program_config.marketplace_deploy_authority.key().as_ref(), // owner
            SEED_MARKETPLACE,
            &program_config.transaction_index.to_le_bytes(),
        ],
        bump,
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [SEED_PROGRAM_PREFIX, SEED_PROGRAM_CONFIG],
        bump  = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,


    pub system_program: Program<'info, System>,
}

impl<'info> MarketplaceCreate<'info> {
    pub fn marketplace_create(ctx: Context<Self>, args: MarketplaceCreateArgs) -> Result<()> {
            let multisig_owner = ctx.accounts.owner.key();
            let local_admin    = args.local_admin;

            let transaction_index = 0;
            let transaction_fee   = args.transaction_fee;

            let bump = ctx.bumps.marketplace;

            ctx.accounts.marketplace.set_inner(Marketplace {
                multisig_owner,
                local_admin,
                transaction_fee,
                transaction_index,
                bump,
            });

            ctx.accounts.program_config.transaction_index =
            ctx.accounts.program_config.transaction_index.checked_add(1).ok_or(
                CustomError::Overflow
            )?;

        Ok(())
    }
}