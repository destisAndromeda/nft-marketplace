# NFT Marketplace

A Solana smart contract built with [Anchor](https://www.anchor-lang.com/) for listing, managing, and trading NFTs powered by [Metaplex Core](https://developers.metaplex.com/core).

> **Devnet Program ID:** `3xypSWG2NbT5Sx3htRgtqy87AEtyu61tvTp1sJab5o2X`

---

## What it does

NFT Marketplace lets users create listings (lots), attach Metaplex Core NFTs to them, manage listing statuses, and eventually trade assets on-chain. Multiple independent marketplace instances can be deployed under a single program, each with its own owner and fee configuration.

---

## Architecture

The program revolves around three on-chain accounts:

**ProgramConfig** stores global settings — the program authority, treasury address, and the key authorized to deploy new marketplace instances. It is initialized once by a hardcoded deployer key.

**Marketplace** represents an independent marketplace instance. Each has its own fee percentage, owner (multisig-ready via `multisig_owner`), and a `transaction_index` used to derive deterministic PDAs for lots.

**Lot** represents a single NFT listing. It holds the asset address, owner, price, payment currency, and current status. Lots are scoped to both a marketplace and an owner — a wallet can only interact with its own lots.

### PDA Seeds

```
ProgramConfig   →  ["marketplace", "program_config"]
Marketplace     →  ["marketplace", deploy_authority, "marketplace", index]
Lot             →  ["marketplace", marketplace_key, "transaction", owner, "lot", lot_index]
```

Because `owner` is part of the Lot seed and is also a `Signer`, no wallet can derive or modify another user's lot.

### Lot Status Flow

A lot moves through the following statuses:

```
Created
  └──► Placed ◄──► AvailableForSale ──► Sold
         │                │
         └────────────────┴──► CancelledByOwner
                               CancelledByMarketplace
```

`Placed` means the lot is on the marketplace but not yet for sale (e.g. displayed in a gallery). `AvailableForSale` opens it for purchase. The owner can move the lot back from `AvailableForSale` to `Placed` at any time.

---

## Instructions

| Instruction | Who can call | Description |
|---|---|---|
| `program_config_init` | Hardcoded initializer | One-time global setup |
| `program_config_update` | Program authority | Update authority, treasury, or deploy authority |
| `marketplace_create` | Deploy authority | Create a new marketplace instance |
| `marketplace_fee_percentage_update` | Marketplace owner | Update trading fee |
| `lot_create` | Any wallet | Create a new lot (status: `Created`) |
| `attach_nft` | Lot owner | Attach a Metaplex Core asset to a lot |
| `place_lot` | Lot owner | Move lot to `Placed` |
| `make_lot_available_for_sale` | Lot owner | Move lot to `AvailableForSale` |

---

## Local Setup

### Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) `0.32.1`
- Node.js + Yarn

### Install dependencies

```bash
yarn install
```

### Build

```bash
anchor build
```

### Run tests

```bash
anchor test
```

### Deploy to Devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

---

## Tech Stack

- [Anchor](https://www.anchor-lang.com/) `0.32.1`
- [Metaplex Core](https://developers.metaplex.com/core) `0.7.2`
- Rust / BPF

---

## Roadmap

- [ ] `buy_lot` — purchase an NFT with SOL or SPL token, atomic payment + CPI transfer via Metaplex Core
- [ ] `cancel_lot` — cancel a listing by owner or marketplace
- [ ] `buy_lot_and_relist` — purchase and immediately create a new lot in one transaction
- [ ] Consolidate status-change instructions into a shared account context
- [ ] TypeScript client / SDK
- [ ] Mainnet deploy with verified build