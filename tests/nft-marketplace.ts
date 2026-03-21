import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { expect } from "chai";

describe("nft-marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;

  const [programConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from("program_config")],
    program.programId
  );

  const initialAuthority = anchor.web3.Keypair.generate();
  const initialMarketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;
  const initialTreasury = anchor.web3.Keypair.generate().publicKey;

  it("Initializes the program config", async () => {
    await program.methods
      .programConfigInit({
        authority: initialAuthority.publicKey,
        marketplaceDeployAuthority: initialMarketplaceDeployAuthority,
        treasury: initialTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.authority.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
  });

  it("Updates only the marketplace deploy authority", async () => {
    const newMarketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .programConfigUpdate({
        authority: null,
        marketplaceDeployAuthority: newMarketplaceDeployAuthority,
        treasury: null,
      })
      .accounts({
        programConfig: programConfigPda,
        authority: initialAuthority.publicKey,
      })
      .signers([initialAuthority])
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.marketplaceDeployAuthority.toBase58()).to.equal(newMarketplaceDeployAuthority.toBase58());
    expect(programConfigAccount.authority.toBase58()).to.equal(initialAuthority.publicKey.toBase58());
    expect(programConfigAccount.treasury.toBase58()).to.equal(initialTreasury.toBase58());
  });

  it("Updates treasury", async () => {
    const newTreasury = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .programConfigUpdate({
        authority: null,
        marketplaceDeployAuthority: null,
        treasury: newTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        authority: initialAuthority.publicKey,
      })
      .signers([initialAuthority])
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.treasury.toBase58()).to.equal(newTreasury.toBase58());
  });

  it("Fails when updated by non-authority", async () => {
    const maliciousActor = anchor.web3.Keypair.generate();
    
    try {
      await program.methods
        .programConfigUpdate({
          authority: null,
          marketplaceDeployAuthority: null,
          treasury: null,
        })
        .accounts({
          programConfig: programConfigPda,
          authority: maliciousActor.publicKey,
        })
        .signers([maliciousActor])
        .rpc();
      expect.fail("Should have failed with CustomError::Unauthorized");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Unauthorized");
    }
  });

  it("Updates everything at once including authority", async () => {
    const newAuthority = anchor.web3.Keypair.generate();
    const newMarketplaceDeployAuthority = anchor.web3.Keypair.generate().publicKey;
    const newTreasury = anchor.web3.Keypair.generate().publicKey;

    await program.methods
      .programConfigUpdate({
        authority: newAuthority.publicKey,
        marketplaceDeployAuthority: newMarketplaceDeployAuthority,
        treasury: newTreasury,
      })
      .accounts({
        programConfig: programConfigPda,
        authority: initialAuthority.publicKey,
      })
      .signers([initialAuthority])
      .rpc();

    const programConfigAccount = await program.account.programConfig.fetch(programConfigPda);
    expect(programConfigAccount.authority.toBase58()).to.equal(newAuthority.publicKey.toBase58());
    
    // Update local variable for subsequent tests if any
    // initialAuthority.publicKey = newAuthority.publicKey; // initialAuthority is Keypair, can't just change pubkey easily in this logic
  });
});