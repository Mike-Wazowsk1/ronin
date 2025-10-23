import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Load a Keypair from a JSON file
 */
export function loadKeypair(filepath: string): Keypair {
  const fullPath = path.resolve(filepath);
  const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(data));
}

/**
 * Generate a random 32-byte ID
 */
export function generateRandomId32(): Buffer {
  return Buffer.from(Keypair.generate().publicKey.toBytes());
}

/**
 * Convert an EVM address string to a 32-byte array
 */
export function evmAddressToBytes32(address: string): number[] {
  // Strip leading 0x if present
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  // Left-pad with zeros to 32 bytes
  const padded = hex.padStart(64, "0");
  const bytes = Buffer.from(padded, "hex");
  return Array.from(bytes);
}

/**
 * Convert a Solana PublicKey to a 32-byte array for LayerZero
 */
export function pubkeyToBytes32(pubkey: PublicKey): number[] {
  return Array.from(pubkey.toBytes());
}

/**
 * Create a buffer with big-endian representation of a number (for EID)
 */
export function u32ToBeBytes(num: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(num, 0);
  return buf;
}

/**
 * Generate a GUID for LayerZero messages
 */
export function generateGuid(): Buffer {
  return Buffer.from(Keypair.generate().publicKey.toBytes());
}

/**
 * Sleep helper to emulate async delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
