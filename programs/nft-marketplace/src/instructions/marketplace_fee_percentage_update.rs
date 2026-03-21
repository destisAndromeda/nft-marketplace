use anchor_lang::prelude::*;

use crate::state::*;
use crate::seeds::*;
use crate::error::*;

// #[derive(AnchorSerialize, AnchorDeserialize)]
// pub struct MarketplaceFeePercentageUpdateArgs {}

// #[derive(Accounts)]
// pub struct MarketplaceFeePercentageUpdate<'info> {
//  #[account(
//      mut,
//      seeds = [],
//      bump  = marketplace.bump,
//  )]
//  pub marketplace: Account<'info, Marketplace>,

// }