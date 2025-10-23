import { PublicKey, AccountMeta, Connection, AccountInfo } from "@solana/web3.js";
import { EndpointProgram, SimpleMessageLibProgram, UlnProgram } from "@layerzerolabs/lz-solana-sdk-v2";
import { BankrunProvider } from "anchor-bankrun";
import { BanksClient } from "solana-bankrun";

export const ENDPOINT_PROGRAM_ID = new PublicKey(
  "76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"
);

export function createBankrunConnectionWrapper(connection: any, banksClient: BanksClient): Connection {
  const wrapper = Object.create(connection);

  wrapper.getMultipleAccountsInfo = async (publicKeys: PublicKey[]): Promise<(AccountInfo<Buffer> | null)[]> => {
    const results: (AccountInfo<Buffer> | null)[] = [];
    
    for (const pubkey of publicKeys) {
      try {
        const account = await banksClient.getAccount(pubkey);
        if (account) {
          results.push({
            executable: account.executable,
            owner: account.owner,
            lamports: Number(account.lamports),
            data: Buffer.from(account.data),
            rentEpoch: account.rentEpoch ? Number(account.rentEpoch) : 0,
          });
        } else {
          results.push(null);
        }
      } catch (error) {
        results.push(null);
      }
    }
    
    return results;
  };
  
  if (!wrapper.getAccountInfo) {
    wrapper.getAccountInfo = async (publicKey: PublicKey): Promise<AccountInfo<Buffer> | null> => {
      const account = await banksClient.getAccount(publicKey);
      if (!account) return null;
      
      return {
        executable: account.executable,
        owner: account.owner,
        lamports: Number(account.lamports),
        data: Buffer.from(account.data),
        rentEpoch: account.rentEpoch ? Number(account.rentEpoch) : 0,
      };
    };
  }
  
  wrapper.getParsedAccountInfo = async (publicKey: PublicKey): Promise<any> => {
    const account = await banksClient.getAccount(publicKey);
    if (!account) return { value: null };
    
    return {
      value: {
        executable: account.executable,
        owner: account.owner,
        lamports: Number(account.lamports),
        data: Buffer.from(account.data),
        rentEpoch: account.rentEpoch ? Number(account.rentEpoch) : 0,
      }
    };
  };
  
  wrapper.getLatestBlockhash = async (commitment?: any): Promise<any> => {
    return {
      blockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 999999999,
    };
  };
  
  wrapper.simulateTransaction = async (transaction: any, config?: any): Promise<any> => {
    return {
      value: {
        err: null,
        logs: ["Program log: Mock simulation"],
        accounts: [],
        unitsConsumed: 100000,
        returnData: null,
      }
    };
  };

  return wrapper as Connection;
}

export function getRegisterOappRemainingAccounts(
  payer: PublicKey,
  oappPDA: PublicKey
): AccountMeta[] {
  const endpointProgram = new EndpointProgram.Endpoint(ENDPOINT_PROGRAM_ID);
  return endpointProgram.getRegisterOappIxAccountMetaForCPI(payer, oappPDA);
}

/**
 * Fetch remaining accounts for send CPI using real endpoint SDK
 * Uses async RPC calls to the endpoint program
 */
export async function getSendRemainingAccounts(
  connection: Connection,
  payer: PublicKey,
  sender: PublicKey,
  dstEid: number,
  receiver: Uint8Array,
  msgLibProgram: SimpleMessageLibProgram.SimpleMessageLib | UlnProgram.Uln
): Promise<AccountMeta[]> {
  const endpointProgram = new EndpointProgram.Endpoint(ENDPOINT_PROGRAM_ID);
  
  const packetPath = {
    dstEid,
    sender,
    receiver: Array.from(receiver),
  };

  try {
    const remainingAccounts = await endpointProgram.getSendIXAccountMetaForCPI(
      connection as any,
      payer,
      { path: packetPath, msgLibProgram },
      "confirmed"
    );
    return remainingAccounts || [];
  } catch (error: any) {
    return [];
  }
}

export async function getSendLibraryProgram(
  connection: Connection,
  oappPDA: PublicKey,
  dstEid: number
): Promise<SimpleMessageLibProgram.SimpleMessageLib | null> {
  const endpointProgram = new EndpointProgram.Endpoint(ENDPOINT_PROGRAM_ID);

  try {
    const sendLibInfo = await endpointProgram.getSendLibrary(connection as any, oappPDA, dstEid);

    if (!sendLibInfo?.programId) {
      return null;
    }

    return new SimpleMessageLibProgram.SimpleMessageLib(sendLibInfo.programId);
  } catch (error: any) {
    return null;
  }
}

export class LayerZeroPDADeriver {
  static oappRegistry(oappPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("OAppRegistry"), oappPDA.toBuffer()],
      ENDPOINT_PROGRAM_ID
    );
  }

  static nonce(
    oappPDA: PublicKey,
    dstEid: number,
    receiver: Uint8Array
  ): [PublicKey, number] {
    const eidBytes = Buffer.alloc(4);
    eidBytes.writeUInt32BE(dstEid, 0);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Nonce"), oappPDA.toBuffer(), eidBytes, Buffer.from(receiver)],
      ENDPOINT_PROGRAM_ID
    );
  }

  static endpointSettings(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Endpoint")],
      ENDPOINT_PROGRAM_ID
    );
  }
}

export function hexToBytes32(hex: string): number[] {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = Buffer.from(cleanHex, 'hex');
  const result = Buffer.alloc(32);
  bytes.copy(result, 32 - bytes.length);
  return Array.from(result);
}

export function numberToBytes32(num: number | bigint): number[] {
  const hex = BigInt(num).toString(16).padStart(64, '0');
  return Array.from(Buffer.from(hex, 'hex'));
}
