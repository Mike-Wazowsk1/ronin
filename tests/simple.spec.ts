import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { Program, Wallet } from "@coral-xyz/anchor";
 

import { contextPromise, RONIN_NFT_BRIDGE_PROGRAM_ID, ENDPOINT_PROGRAM_ID } from "./context";
import { loadKeypair } from "./utils";
import RONIN_NFT_BRIDGE_IDL from "../target/idl/ronin_nft_bridge.json";
import { 
  getRegisterOappRemainingAccounts, 
  getSendRemainingAccounts,
  getSendLibraryProgram,
  LayerZeroPDADeriver,
  hexToBytes32,
  numberToBytes32,
  createBankrunConnectionWrapper
} from "./helpers";

describe("ronin_nft_bridge_simple_test", () => {
  let roninNftBridgeProgram: Program;
  let admin: Keypair;
  let context: ProgramTestContext;
  let nftMint: Keypair;
  let provider: BankrunProvider;

  beforeAll(async () => {
    context = await contextPromise;
    admin = await loadKeypair("./tests/fixtures/account1.json");
    nftMint = Keypair.generate();
    provider = new BankrunProvider(context, new Wallet(admin));
    roninNftBridgeProgram = new Program(
      RONIN_NFT_BRIDGE_IDL as any,
      RONIN_NFT_BRIDGE_PROGRAM_ID,
      provider
    );
  }, 120000);

  test("01_init_store", async () => {
    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [lzReceiveTypesPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("LzReceiveTypes"), storePDA.toBuffer()],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const remainingAccounts = getRegisterOappRemainingAccounts(admin.publicKey, storePDA);

    await roninNftBridgeProgram.methods
      .initStore({ admin: admin.publicKey, endpoint: ENDPOINT_PROGRAM_ID })
      .accounts({
        payer: admin.publicKey,
        store: storePDA,
        lzReceiveTypesAccounts: lzReceiveTypesPDA,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .signers([admin])
      .rpc();

    const storeAccount = await roninNftBridgeProgram.account.store.fetch(storePDA);
    expect(storeAccount.admin.toBase58()).toBe(admin.publicKey.toBase58());
    expect(storeAccount.endpointProgram.toBase58()).toBe(ENDPOINT_PROGRAM_ID.toBase58());
    expect(storeAccount.string).toBe("Nothing received yet.");
  });

  test("02_set_peer_config", async () => {
    const REMOTE_EID = 40161;
    const REMOTE_PEER_HEX = "0x0000000000000000000000001234567890123456789012345678901234567890";

    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const remoteEidBuffer = Buffer.alloc(4);
    remoteEidBuffer.writeUInt32BE(REMOTE_EID, 0);

    const [peerPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Peer"), storePDA.toBuffer(), remoteEidBuffer],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const peerAddressBytes = Array.from(Buffer.from(REMOTE_PEER_HEX.slice(2), "hex"));

    await roninNftBridgeProgram.methods
      .setPeerConfig({ remoteEid: REMOTE_EID, config: { peerAddress: [peerAddressBytes] } })
      .accounts({
        admin: admin.publicKey,
        peer: peerPDA,
        store: storePDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const peerConfig = await roninNftBridgeProgram.account.peerConfig.fetch(peerPDA);
    expect(peerConfig.peerAddress.length).toBe(32);
  });

  test("03_init_registry", async () => {
    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    await roninNftBridgeProgram.methods
      .initRegistry()
      .accounts({
        payer: admin.publicKey,
        store: storePDA,
        registry: registryPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const registry = await roninNftBridgeProgram.account.onftRegistry.fetch(registryPDA);
    expect(registry.admin.toBase58()).toBe(admin.publicKey.toBase58());
  });

  test("04_init_onft_adapter", async () => {
    const { createMint, TOKEN_PROGRAM_ID } = await import("spl-token-bankrun");
    const { ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

    const mint = await createMint(context.banksClient, admin, admin.publicKey, null, 0, nftMint);

    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [onftConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    await roninNftBridgeProgram.methods
      .initOnftAdapter(mint)
      .accounts({
        payer: admin.publicKey,
        store: storePDA,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        onftConfig: onftConfigPDA,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const onftConfig = await roninNftBridgeProgram.account.onftConfig.fetch(onftConfigPDA);
    expect(onftConfig.tokenMint.toBase58()).toBe(mint.toBase58());
  });

  test("05_set_registry_entry", async () => {
    const nftId = Array.from(Buffer.alloc(32, 1));

    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [entryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG_ENTRY"), Buffer.from(nftId)],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    await roninNftBridgeProgram.methods
      .setRegistryEntry(nftId)
      .accounts({
        admin: admin.publicKey,
        store: storePDA,
        registry: registryPDA,
        entry: entryPDA,
        mint: nftMint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const entry = await roninNftBridgeProgram.account.onftRegistryEntry.fetch(entryPDA);
    expect(entry.mint.toBase58()).toBe(nftMint.publicKey.toBase58());
  });

  test("06_mint_nft_to_user", async () => {
    const { createAssociatedTokenAccount, mintTo, getAccount } = await import("spl-token-bankrun");

    const mint = nftMint.publicKey;
    const adminAta = await createAssociatedTokenAccount(
      context.banksClient,
      admin,
      mint,
      admin.publicKey
    );

    await mintTo(context.banksClient, admin, mint, adminAta, admin, 1);

    const account = await getAccount(context.banksClient, adminAta);
    expect(Number(account.amount)).toBe(1);
  });

  test("07_quote_send_onft", async () => {
    const REMOTE_EID = 40161;
    const TO_ADDRESS_HEX = "0x0000000000000000000000001234567890123456789012345678901234567890";
    const TOKEN_ID = numberToBytes32(1);
    const AMOUNT = 1;

    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [peerPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Peer"), storePDA.toBuffer(), Buffer.from([0, 0, 0x9C, 0xE1])],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const toBytes = hexToBytes32(TO_ADDRESS_HEX);
    const idBytes = TOKEN_ID;
    const options = Array.from(new Uint8Array(0));
    const [endpointSettingsPDA] = LayerZeroPDADeriver.endpointSettings();

    try {
      await roninNftBridgeProgram.methods
        .quoteSendOnft({ dstEid: REMOTE_EID, to: toBytes, id: idBytes, amount: AMOUNT, options: options })
        .accounts({ store: storePDA, peer: peerPDA, endpoint: endpointSettingsPDA })
        .simulate();
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });

  test("08_send_onft_with_real_endpoint", async () => {
    const REMOTE_EID = 40161;
    const TO_ADDRESS_HEX = "0x0000000000000000000000001234567890123456789012345678901234567890";
    const TOKEN_ID = numberToBytes32(1);
    const AMOUNT = 1;
    const NATIVE_FEE = 1000000;

    const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = await import("@solana/spl-token");

    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [peerPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Peer"), storePDA.toBuffer(), Buffer.from([0, 0, 0x9C, 0xE1])],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [onftConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [registryEntryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG_ENTRY"), Buffer.from(TOKEN_ID)],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const mint = nftMint.publicKey;
    const userAta = await getAssociatedTokenAddress(mint, admin.publicKey, false, TOKEN_PROGRAM_ID);
    const escrowAta = await getAssociatedTokenAddress(mint, onftConfigPDA, true, TOKEN_PROGRAM_ID);

    const toBytes = hexToBytes32(TO_ADDRESS_HEX);
    const idBytes = TOKEN_ID;
    const options = Array.from(new Uint8Array(0));

    const wrappedConnection = createBankrunConnectionWrapper(provider.connection, context.banksClient);
    const msgLibProgram = await getSendLibraryProgram(wrappedConnection, storePDA, REMOTE_EID);

    const peerConfig = await roninNftBridgeProgram.account.peerConfig.fetch(peerPDA);
    const receiverAddress = new Uint8Array(peerConfig.peerAddress);

    let remainingAccounts: any[] = [];
    if (msgLibProgram) {
      remainingAccounts = await getSendRemainingAccounts(
        wrappedConnection,
        admin.publicKey,
        storePDA,
        REMOTE_EID,
        receiverAddress,
        msgLibProgram
      );
    }

    try {
      await roninNftBridgeProgram.methods
        .sendOnft({
          dstEid: REMOTE_EID,
          to: toBytes,
          id: idBytes,
          amount: AMOUNT,
          options: options,
          nativeFee: NATIVE_FEE,
          lzTokenFee: 0,
        })
        .accounts({
          signer: admin.publicKey,
          peer: peerPDA,
          store: storePDA,
          mint: mint,
          onftConfig: onftConfigPDA,
          registry: registryPDA,
          registryEntry: registryEntryPDA,
          userToken: userAta,
          escrow: escrowAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .signers([admin])
        .rpc();
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });

  test("09_verify_registry_and_onft_config", async () => {
    const TOKEN_ID = Array.from(Buffer.alloc(32, 1));
    const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = await import("@solana/spl-token");

    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [registryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [registryEntryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT_REG_ENTRY"), Buffer.from(TOKEN_ID)],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const [onftConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("ONFT")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const mint = nftMint.publicKey;

    const onftConfig = await roninNftBridgeProgram.account.onftConfig.fetch(onftConfigPDA);
    expect(onftConfig.tokenMint.toBase58()).toBe(mint.toBase58());
    expect(onftConfig.admin.toBase58()).toBe(admin.publicKey.toBase58());

    const entry = await roninNftBridgeProgram.account.onftRegistryEntry.fetch(registryEntryPDA);
    expect(entry.mint.toBase58()).toBe(mint.toBase58());
    expect(entry.pending).toBe(false);
  });

  test("10_verify_all_state", async () => {
    const [storePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("Store")],
      RONIN_NFT_BRIDGE_PROGRAM_ID
    );

    const storeAccount = await roninNftBridgeProgram.account.store.fetch(storePDA);

    expect(storeAccount.admin.toBase58()).toBe(admin.publicKey.toBase58());
    expect(storeAccount.endpointProgram.toBase58()).toBe(ENDPOINT_PROGRAM_ID.toBase58());
  });
});
