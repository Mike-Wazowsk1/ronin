import { publicKey, PublicKey as UmiPublicKey, Umi, transactionBuilder } from "@metaplex-foundation/umi";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { myoapp } from "../../lib/client";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

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

export async function claim(
  umi: Umi,
  client: RoninNftBridge,
  idDecimal: string,
  toOwner: UmiPublicKey,
  connection: any // Solana Connection for reading on-chain data
) {
  const [storePda] = client.pda.oapp();
  const programIdW = toWeb3JsPublicKey(client.programId);
  
  const id32 = idToBytes32(idDecimal);
  const [registryEntry] = PublicKey.findProgramAddressSync(
    [REG_ENTRY_SEED, Buffer.from(id32)],
    programIdW
  );

  // Read registry entry to get mint and other data
  const entryInfo = await connection.getAccountInfo(registryEntry);
  if (!entryInfo) throw new Error('registry_entry not found');
  const data = entryInfo.data;

  // OnftRegistryEntry layout: [8 discriminator][32 id32][32 mint][32 pending_to][8 pending_amount][1 pending][1 bump]
  if (data.length < 8 + 32 + 32 + 32 + 8 + 1 + 1) throw new Error('registry_entry too small');
  const mintPk = new PublicKey(data.slice(8 + 32, 8 + 32 + 32));
  const pendingFlag = data[8 + 32 + 32 + 32 + 8] === 1;

  if (!pendingFlag) throw new Error('no pending claim in entry');

  const [onftSigner] = PublicKey.findProgramAddressSync([ONFT_SEED], programIdW);
  const toOwnerWeb3 = toWeb3JsPublicKey(toOwner);

  // Read OnftConfig to get tokenProgram
  const onftConfigInfo = await connection.getAccountInfo(onftSigner);
  if (!onftConfigInfo) throw new Error('onft_config not found');
  // OnftConfig layout: [8 discriminator][32 admin][32 token_mint][32 token_program][32 escrow][1 bump]
  if (onftConfigInfo.data.length < 8 + 32 + 32 + 32 + 32 + 1) throw new Error('onft_config too small');
  const tokenProgramPk = new PublicKey(onftConfigInfo.data.slice(8 + 32 + 32, 8 + 32 + 32 + 32));

  // Derive escrow and dest using tokenProgram from config
  const escrowAta = await getAssociatedTokenAddress(mintPk, onftSigner, true, tokenProgramPk, ATA_PROGRAM);
  const toAta = await getAssociatedTokenAddress(mintPk, toOwnerWeb3, false, tokenProgramPk, ATA_PROGRAM);

  const [registry] = PublicKey.findProgramAddressSync([REGISTRY_SEED], programIdW);

  const ix = client.claim(
    {
      signer: umi.identity,
      store: storePda,
      registry: publicKey(registry),
      entry: publicKey(registryEntry),
      mint: publicKey(mintPk),
      onftConfig: publicKey(onftSigner),
      escrow: publicKey(escrowAta),
      dest: publicKey(toAta),
      tokenProgram: publicKey(tokenProgramPk),
      associatedTokenProgram: publicKey(ATA_PROGRAM),
      systemProgram: publicKey('11111111111111111111111111111111'),
    },
    { id32: Array.from(id32) as any }
  );

  const tx = await transactionBuilder().add(ix).sendAndConfirm(umi);
  return { signature: tx.signature };
}