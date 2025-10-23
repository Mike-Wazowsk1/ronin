import { publicKey, PublicKey as UmiPublicKey, Umi } from "@metaplex-foundation/umi";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { instructions, accounts as genAccounts, myoapp } from "../../lib/client";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Options } from "@layerzerolabs/lz-v2-utilities";

type RoninNftBridge = myoapp.RoninNftBridge;

const ONFT_SEED = Buffer.from("ONFT");
const REGISTRY_SEED = Buffer.from("ONFT_REG");
const REG_ENTRY_SEED = Buffer.from("ONFT_REG_ENTRY");

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

function idToBytes32(id: string): Uint8Array {
  const bi = BigInt(id);
  const hex = bi.toString(16).padStart(64, '0');
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function evmAddressToBytes32(address: string): Uint8Array {
  const hex = address.replace(/^0x/, '');
  const buf = Buffer.from(hex, 'hex');
  return Uint8Array.from([...new Uint8Array(32 - buf.length), ...buf]);
}

export async function sendOnft(
  umi: Umi,
  client: RoninNftBridge,
  dstEid: number,
  toEvmAddress: string,
  idDecimal: string,
  amount: number,
  mintPubkey: UmiPublicKey,
  nativeFee?: number,
  lzTokenFee: number = 0
) {
  const [storePDA] = client.pda.oapp();
  const to32 = evmAddressToBytes32(toEvmAddress);
  const id32 = idToBytes32(idDecimal);
  const options = Options.newOptions()
    .addExecutorLzReceiveOption(200000, 0)
    .toBytes();

  const [peerPda] = client.pda.peer(dstEid);
  const [onftPda] = PublicKey.findProgramAddressSync(
    [ONFT_SEED],
    toWeb3JsPublicKey(client.programId)
  );
  const [registryPda] = PublicKey.findProgramAddressSync(
    [REGISTRY_SEED],
    toWeb3JsPublicKey(client.programId)
  );
  const [entryPda] = PublicKey.findProgramAddressSync(
    [REG_ENTRY_SEED, Buffer.from(id32)],
    toWeb3JsPublicKey(client.programId)
  );

  const mintWeb3 = toWeb3JsPublicKey(mintPubkey);
  const ownerWeb3 = toWeb3JsPublicKey(umi.identity.publicKey);
  
  const userAtaWeb3 = await getAssociatedTokenAddress(
    mintWeb3,
    ownerWeb3,
    false,
    TOKEN_PROGRAM,
    ATA_PROGRAM
  );

  const escrowWeb3 = await getAssociatedTokenAddress(
    mintWeb3,
    onftPda,
    true,
    TOKEN_PROGRAM,
    ATA_PROGRAM
  );

  const userAtaPk = publicKey(userAtaWeb3);
  const escrowPk = publicKey(escrowWeb3);

  // Fetch remaining accounts for Endpoint CPI
  const receiverInfo = await genAccounts.fetchPeerConfig(umi, peerPda);
  const msgLibProgram = await client.getSendLibraryProgram(umi.rpc, umi.identity.publicKey, dstEid);
  const remainingAccounts = await client.endpointSDK.getSendIXAccountMetaForCPI(
    umi.rpc,
    umi.identity.publicKey,
    {
      path: {
        dstEid,
        sender: storePDA,
        receiver: receiverInfo.peerAddress,
      },
      msgLibProgram,
    },
  );

  const sendBuilder = instructions.sendOnft(
    { programs: client.programRepo },
    {
      signer: umi.identity,
      peer: peerPda,
      store: storePDA,
      mint: mintPubkey,
      onftConfig: publicKey(onftPda),
      registry: publicKey(registryPda),
      registryEntry: publicKey(entryPda),
      userToken: userAtaPk,
      escrow: escrowPk,
      tokenProgram: publicKey(TOKEN_PROGRAM),
      associatedTokenProgram: publicKey(ATA_PROGRAM),
      systemProgram: publicKey('11111111111111111111111111111111'),
      dstEid,
      to: to32 as any,
      id: id32 as any,
      amount,
      options: options as any,
      nativeFee: nativeFee ?? 0,
      lzTokenFee,
    },
  ).addRemainingAccounts(remainingAccounts);

  const tx = await sendBuilder.sendAndConfirm(umi);
  return { signature: tx.signature };
}