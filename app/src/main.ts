import "./style.css";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "../../target/idl/nft_marketplace.json";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: web3.PublicKey;
  connect: () => Promise<{ publicKey: web3.PublicKey }>;
  signTransaction: (tx: web3.Transaction) => Promise<web3.Transaction>;
  signAllTransactions: (txs: web3.Transaction[]) => Promise<web3.Transaction[]>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

const PROGRAM_ID = new web3.PublicKey("3xypSWG2NbT5Sx3htRgtqy87AEtyu61tvTp1sJab5o2X");
const CORE_PROGRAM_ID = new web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SYSTEM_PROGRAM_ID = web3.SystemProgram.programId;
const encoder = new TextEncoder();

const state: {
  provider?: AnchorProvider;
  program?: Program<any>;
  wallet?: web3.PublicKey;
} = {};

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="container">
    <h1>NFT Marketplace TX Builder</h1>
    <p class="subtitle">Simple frontend to call on-chain instructions.</p>

    <section class="card">
      <h2>Connection</h2>
      <div class="row">
        <label>RPC URL</label>
        <input id="rpcUrl" value="http://127.0.0.1:8899" />
      </div>
      <button id="connectBtn">Connect Phantom</button>
      <p id="walletText">Wallet: not connected</p>
    </section>

    <section class="card grid">
      <h2>Shared Inputs</h2>
      <div class="row"><label>Marketplace Index</label><input id="marketplaceIndex" value="0" /></div>
      <div class="row"><label>Lot Index</label><input id="lotIndex" value="0" /></div>
      <div class="row"><label>Lot Owner / Salesperson</label><input id="lotOwner" placeholder="Pubkey" /></div>
      <div class="row"><label>Asset Mint/Core Asset</label><input id="asset" placeholder="Pubkey" /></div>
      <div class="row"><label>Currency Mint (optional)</label><input id="currency" placeholder="Pubkey or empty for SOL" /></div>
      <div class="row"><label>Price (u64)</label><input id="price" value="1000000" /></div>
      <div class="row"><label>Treasury</label><input id="treasury" placeholder="Pubkey (optional override)" /></div>
      <div class="row"><label>Authority</label><input id="authority" placeholder="Pubkey (optional override)" /></div>
      <div class="row"><label>Deploy Authority</label><input id="deployAuthority" placeholder="Pubkey (optional override)" /></div>
      <div class="row"><label>Local Admin</label><input id="localAdmin" placeholder="Pubkey (optional override)" /></div>
      <div class="row"><label>Fee / Transaction Fee</label><input id="txFee" value="500" /></div>
    </section>

    <section class="card">
      <h2>Program Config</h2>
      <div class="buttonRow">
        <button id="programConfigInitBtn">programConfigInit</button>
        <button id="programConfigUpdateBtn">programConfigUpdate</button>
      </div>
    </section>

    <section class="card">
      <h2>Marketplace</h2>
      <div class="buttonRow">
        <button id="marketplaceCreateBtn">marketplaceCreate</button>
        <button id="marketplaceFeeUpdateBtn">marketplaceTransactionFeeUpdate</button>
      </div>
    </section>

    <section class="card">
      <h2>Lot Lifecycle</h2>
      <div class="buttonRow">
        <button id="lotCreateBtn">lotCreate</button>
        <button id="listNftBtn">listNft</button>
        <button id="placeLotBtn">placeLot</button>
        <button id="availableBtn">makeLotAvailableForSale</button>
      </div>
    </section>

    <section class="card">
      <h2>Trading + Cancel</h2>
      <div class="buttonRow">
        <button id="buySolBtn">buyNftInSol</button>
        <button id="buyTokenBtn">buyNftInToken</button>
        <button id="cancelOwnerBtn">cancelByOwner</button>
        <button id="cancelMarketBtn">cancelByMarketplace</button>
      </div>
    </section>

    <section class="card">
      <h2>Output</h2>
      <pre id="logs"></pre>
    </section>
  </main>
`;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function value(id: string): string {
  return el<HTMLInputElement>(id).value.trim();
}

function pk(input: string): web3.PublicKey {
  return new web3.PublicKey(input);
}

function maybePk(input: string): web3.PublicKey | null {
  return input ? pk(input) : null;
}

function u64(id: string): BN {
  return new BN(value(id));
}

function logLine(msg: string): void {
  const logs = el<HTMLElement>("logs");
  logs.textContent = `${new Date().toLocaleTimeString()} ${msg}\n${logs.textContent}`;
}

function walletOrThrow(): web3.PublicKey {
  if (!state.wallet) {
    throw new Error("Connect wallet first");
  }
  return state.wallet;
}

function getProgram(): Program<any> {
  if (!state.program) {
    throw new Error("Program is not initialized");
  }
  return state.program;
}

async function programConfigPda(): Promise<web3.PublicKey> {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [encoder.encode("marketplace"), encoder.encode("program_config")],
    PROGRAM_ID,
  );
  return pda;
}

function marketplacePda(deployAuthority: web3.PublicKey, marketplaceIndex: BN): web3.PublicKey {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [
      encoder.encode("marketplace"),
      deployAuthority.toBuffer(),
      encoder.encode("marketplace"),
      marketplaceIndex.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  );
  return pda;
}

function lotPda(marketplace: web3.PublicKey, owner: web3.PublicKey, lotIndex: BN): web3.PublicKey {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [
      encoder.encode("marketplace"),
      marketplace.toBuffer(),
      encoder.encode("transaction"),
      owner.toBuffer(),
      encoder.encode("lot"),
      lotIndex.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  );
  return pda;
}

async function fetchProgramConfig() {
  const program = getProgram();
  const pda = await programConfigPda();
  return { pda, account: await (program.account as any).programConfig.fetch(pda) };
}

el<HTMLButtonElement>("connectBtn").onclick = async () => {
  if (!window.solana?.isPhantom) {
    logLine("Phantom wallet not found");
    return;
  }

  const rpcUrl = value("rpcUrl");
  const conn = new web3.Connection(rpcUrl, "confirmed");
  const walletProvider = window.solana;
  const connected = await walletProvider.connect();
  const wallet = connected.publicKey;

  const walletShim = {
    publicKey: wallet,
    signTransaction: walletProvider.signTransaction.bind(walletProvider),
    signAllTransactions: walletProvider.signAllTransactions.bind(walletProvider),
  } as AnchorProvider["wallet"];

  const provider = new AnchorProvider(conn, walletShim, AnchorProvider.defaultOptions());
  const program = new Program(idlJson as any, provider) as Program<any>;

  state.wallet = wallet;
  state.provider = provider;
  state.program = program;

  el<HTMLElement>("walletText").textContent = `Wallet: ${wallet.toBase58()}`;
  logLine(`Connected to ${rpcUrl}`);
};

async function send(label: string, fn: () => Promise<string>) {
  try {
    const sig = await fn();
    logLine(`${label}: ${sig}`);
  } catch (error) {
    logLine(`${label} failed: ${(error as Error).message}`);
  }
}

el<HTMLButtonElement>("programConfigInitBtn").onclick = () =>
  send("programConfigInit", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const cfg = await programConfigPda();
    return (program.methods as any)
      .programConfigInit({
        authority: maybePk(value("authority")) ?? wallet,
        marketplaceDeployAuthority: maybePk(value("deployAuthority")) ?? wallet,
        treasury: maybePk(value("treasury")) ?? wallet,
      })
      .accounts({
        programConfig: cfg,
        initializer: wallet,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("programConfigUpdateBtn").onclick = () =>
  send("programConfigUpdate", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const cfg = await programConfigPda();
    return (program.methods as any)
      .programConfigUpdate({
        authority: maybePk(value("authority")),
        marketplaceDeployAuthority: maybePk(value("deployAuthority")),
        treasury: maybePk(value("treasury")),
      })
      .accounts({
        programConfig: cfg,
        authority: wallet,
      })
      .rpc();
  });

el<HTMLButtonElement>("marketplaceCreateBtn").onclick = () =>
  send("marketplaceCreate", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const { pda: cfg, account } = await fetchProgramConfig();
    const mIndex = u64("marketplaceIndex");
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    return (program.methods as any)
      .marketplaceCreate({
        localAdmin: maybePk(value("localAdmin")) ?? wallet,
        transactionFee: u64("txFee"),
      })
      .accounts({
        owner: wallet,
        marketplace: market,
        programConfig: cfg,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("marketplaceFeeUpdateBtn").onclick = () =>
  send("marketplaceTransactionFeeUpdate", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const { pda: cfg, account } = await fetchProgramConfig();
    const mIndex = u64("marketplaceIndex");
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    return (program.methods as any)
      .marketplaceTransactionFeeUpdate({
        selfIndex: mIndex,
        transactionFee: u64("txFee"),
      })
      .accounts({
        marketplace: market,
        multisigOwner: wallet,
        programConfig: cfg,
      })
      .rpc();
  });

el<HTMLButtonElement>("lotCreateBtn").onclick = () =>
  send("lotCreate", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const mIndex = u64("marketplaceIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const marketState = await (program.account as any).marketplace.fetch(market);
    const lot = lotPda(market, wallet, marketState.transactionIndex);
    return (program.methods as any)
      .lotCreate({
        marketplaceIndex: mIndex,
        asset: pk(value("asset")),
        currency: maybePk(value("currency")),
        price: u64("price"),
      })
      .accounts({
        owner: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("listNftBtn").onclick = () =>
  send("listNft", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const lotOwner = maybePk(value("lotOwner")) ?? wallet;
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, lotOwner, lIndex);
    return (program.methods as any)
      .listNft({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
        salesperson: lotOwner,
      })
      .accounts({
        owner: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
        systemProgram: SYSTEM_PROGRAM_ID,
        asset: pk(value("asset")),
        coreProgram: CORE_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("placeLotBtn").onclick = () =>
  send("placeLot", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, wallet, lIndex);
    return (program.methods as any)
      .placeLot({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
      })
      .accounts({
        owner: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
      })
      .rpc();
  });

el<HTMLButtonElement>("availableBtn").onclick = () =>
  send("makeLotAvailableForSale", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, wallet, lIndex);
    return (program.methods as any)
      .makeLotAvailableForSale({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
      })
      .accounts({
        owner: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
      })
      .rpc();
  });

el<HTMLButtonElement>("buySolBtn").onclick = () =>
  send("buyNftInSol", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const lotOwner = pk(value("lotOwner"));
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const treasuryOverride = maybePk(value("treasury"));
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, lotOwner, lIndex);
    return (program.methods as any)
      .buyNftInSol({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
        salesperson: lotOwner,
      })
      .accounts({
        buyer: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
        treasury: treasuryOverride ?? account.treasury,
        salesperson: lotOwner,
        asset: pk(value("asset")),
        coreProgram: CORE_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("buyTokenBtn").onclick = () =>
  send("buyNftInToken", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const lotOwner = pk(value("lotOwner"));
    const currencyMint = pk(value("currency"));
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, lotOwner, lIndex);

    const salespersonTokenReceive = getAssociatedTokenAddressSync(currencyMint, lotOwner);
    const buyerTokenTransfer = getAssociatedTokenAddressSync(currencyMint, wallet);

    return (program.methods as any)
      .buyNftInToken({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
        lotOwner,
      })
      .accounts({
        buyer: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
        salesperson: lotOwner,
        asset: pk(value("asset")),
        coreProgram: CORE_PROGRAM_ID,
        salespersonTokenMint: currencyMint,
        salespersonTokenReceive,
        buyerTokenTransfer,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("cancelOwnerBtn").onclick = () =>
  send("cancelByOwner", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, wallet, lIndex);
    return (program.methods as any)
      .cancelByOwner({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
      })
      .accounts({
        owner: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
        asset: pk(value("asset")),
        coreProgram: CORE_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .rpc();
  });

el<HTMLButtonElement>("cancelMarketBtn").onclick = () =>
  send("cancelByMarketplace", async () => {
    const program = getProgram();
    const wallet = walletOrThrow();
    const lotOwner = pk(value("lotOwner"));
    const mIndex = u64("marketplaceIndex");
    const lIndex = u64("lotIndex");
    const { pda: cfg, account } = await fetchProgramConfig();
    const market = marketplacePda(account.marketplaceDeployAuthority, mIndex);
    const lot = lotPda(market, lotOwner, lIndex);
    return (program.methods as any)
      .cancelByMarketplace({
        marketplaceIndex: mIndex,
        lotIndex: lIndex,
        lotOwner,
      })
      .accounts({
        localAdmin: wallet,
        lot,
        marketplace: market,
        programConfig: cfg,
        asset: pk(value("asset")),
        sourceOwner: lotOwner,
        coreProgram: CORE_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .rpc();
  });
