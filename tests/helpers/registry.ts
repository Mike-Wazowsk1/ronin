import { publicKey, PublicKey as UmiPublicKey, Umi } from "@metaplex-foundation/umi";
import { instructions, myoapp } from "../../lib/client";
import { PublicKey } from "@solana/web3.js";

type RoninNftBridge = myoapp.RoninNftBridge;

const REGISTRY_SEED = Buffer.from("ONFT_REG");
const REG_ENTRY_SEED = Buffer.from("ONFT_REG_ENTRY");

// Helper to convert decimal ID to bytes32
function idToBytes32(id: string): Uint8Array {
  const bi = BigInt(id);
  const hex = bi.toString(16).padStart(64, '0');
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export async function initRegistry(
  umi: Umi,
  client: RoninNftBridge
) {
  const [storePda] = client.pda.oapp();
  const [registry] = PublicKey.findProgramAddressSync(
    [REGISTRY_SEED],
    PublicKey.from(client.programId)
  );

  const ix = instructions.initRegistry(
    { payer: umi.identity, programs: client.programRepo },
    {
      store: storePda,
      registry: publicKey(registry),
      systemProgram: publicKey('11111111111111111111111111111111'),
    }
  );

  const tx = await ix.sendAndConfirm(umi);
  return { registryPDA: publicKey(registry), signature: tx.signature };
}

export async function setRegistryEntry(
  umi: Umi,
  client: RoninNftBridge,
  idDecimal: string,
  mint: UmiPublicKey
) {
  const id32 = idToBytes32(idDecimal);
  const [storePda] = client.pda.oapp();
  const [registry] = PublicKey.findProgramAddressSync(
    [REGISTRY_SEED],
    PublicKey.from(client.programId)
  );
  const [entry] = PublicKey.findProgramAddressSync(
    [REG_ENTRY_SEED, Buffer.from(id32)],
    PublicKey.from(client.programId)
  );

  const ix = instructions.setRegistryEntry(
    { programs: client.programRepo },
    {
      admin: umi.identity,
      store: storePda,
      registry: publicKey(registry),
      mint: mint,
      entry: publicKey(entry),
      id32: Array.from(id32) as any,
    }
  );

  const tx = await ix.sendAndConfirm(umi);
  return { entryPDA: publicKey(entry), signature: tx.signature };
}

export function getRegistryPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([REGISTRY_SEED], programId);
}

export function getRegistryEntryPDA(
  programId: PublicKey,
  idDecimal: string
): [PublicKey, number] {
  const id32 = idToBytes32(idDecimal);
  return PublicKey.findProgramAddressSync([REG_ENTRY_SEED, Buffer.from(id32)], programId);
}