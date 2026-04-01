use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        Mint,
        TokenAccount,
        TokenInterface,
        TransferChecked,
        transfer_checked,
    },
};

use mpl_core::{
    instructions::TransferV1CpiBuilder,
    programs,
};

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct BuyNftInTokenArgs {
    pub marketplace_index: u64,

    pub lot_index: u64,

    pub lot_owner: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: BuyNftInTokenArgs)]
pub struct BuyNftInToken<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            SEED_PROGRAM_PREFIX,
            marketplace.key().as_ref(),
            SEED_TRANSACTION,
            args.lot_owner.key().as_ref(),
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

    /// CHECK: Lot owner, receives the token payment
    #[account(mut, address = lot.owner)]
    pub salesperson: UncheckedAccount<'info>,

    // #[account()]
    // pub treasury: AccountInfo<'info>,

    /// CHECK: Account of asset that containing inside the lot
    #[account(mut, address = lot.asset)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: mpl_core program
    #[account(address = programs::MPL_CORE_ID)]
    pub core_program: UncheckedAccount<'info>,

    #[account(address = lot.currency.unwrap()
        @ CustomError::InvalidAsset,
    )]
    pub salesperson_token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed, // UNSAFE!!!!!
        payer = buyer,
        associated_token::mint = salesperson_token_mint,
        associated_token::authority = salesperson,
        associated_token::token_program = token_program,
    )]
    pub salesperson_token_receive: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = salesperson_token_mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program,
    )]
    pub buyer_token_transfer: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> BuyNftInToken<'info> {
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
    pub fn buy_nft_in_token(ctx: Context<Self>, args: BuyNftInTokenArgs) -> Result<()> {
        let transfer_accounts = TransferChecked {
            from:      ctx.accounts.buyer_token_transfer.to_account_info(),
            mint:      ctx.accounts.salesperson_token_mint.to_account_info(),
            to:        ctx.accounts.salesperson_token_receive.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_accounts,
            ),
            ctx.accounts.lot.price,
            ctx.accounts.salesperson_token_mint.decimals,
        )?;

        let marketplace_key = ctx.accounts.marketplace.key();
        let salesperson_key = ctx.accounts.salesperson.key();
        let lot_index_bytes = args.lot_index.to_le_bytes();
        let lot_bump        = ctx.accounts.lot.bump;

        let lot_seeds: &[&[u8]] = &[
            SEED_PROGRAM_PREFIX,
            marketplace_key.as_ref(),
            SEED_TRANSACTION,
            salesperson_key.as_ref(),
            SEED_LOT,
            &lot_index_bytes,
            &[lot_bump],
        ];

        TransferV1CpiBuilder::new(&ctx.accounts.core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .payer(&ctx.accounts.buyer.to_account_info())
            .authority(Some(&ctx.accounts.lot.to_account_info()))
            .new_owner(&ctx.accounts.buyer.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[lot_seeds])?;

        let lot = &mut ctx.accounts.lot;
        lot.status = LotStatus::Sold {
            timestamp: Clock::get()?.unix_timestamp,
        };

        lot.is_listed = false;

        Ok(())
    }
}