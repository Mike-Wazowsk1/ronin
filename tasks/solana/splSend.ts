import { task, types } from 'hardhat/config'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
    createTransferInstruction,
} from '@solana/spl-token'
import { existsSync, readFileSync } from 'node:fs'
import bs58 from 'bs58'

function loadKeypairFromArg(secret: string): Keypair {
    // If points to a file, read JSON array from it
    if (existsSync(secret)) {
        const raw = readFileSync(secret, 'utf8')
        const arr = JSON.parse(raw) as number[]
        return Keypair.fromSecretKey(Uint8Array.from(arr))
    }
    // Else expect inline JSON array string: "[1,2,...]"
    const trimmed = secret.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const arr = JSON.parse(trimmed) as number[]
        return Keypair.fromSecretKey(Uint8Array.from(arr))
    }
    throw new Error('secret должен быть путем к файлу с JSON-массивом ключа или самим JSON-массивом')
}

function loadKeypairFromEnv(): Keypair {
    const envJson = process.env.SOLANA_MINT_AUTHORITY
    const envPath = process.env.SOLANA_MINT_AUTHORITY_PATH
    if (envJson && envJson.trim().length > 0) {
        try {
            const arr = JSON.parse(envJson) as number[]
            return Keypair.fromSecretKey(Uint8Array.from(arr))
        } catch (e) {
            // if it's not JSON, maybe it's a base58 string or a path
            try {
                const decoded = bs58.decode(envJson)
                return Keypair.fromSecretKey(Uint8Array.from(decoded))
            } catch (_) {}
            if (existsSync(envJson)) {
                const raw = readFileSync(envJson, 'utf8')
                const arr = JSON.parse(raw) as number[]
                return Keypair.fromSecretKey(Uint8Array.from(arr))
            }
            throw new Error('SOLANA_MINT_AUTHORITY должен быть JSON-массивом приватного ключа или путем к файлу')
        }
    }
    if (envPath && existsSync(envPath)) {
        const raw = readFileSync(envPath, 'utf8')
        const arr = JSON.parse(raw) as number[]
        return Keypair.fromSecretKey(Uint8Array.from(arr))
    }
    throw new Error('Не найден приватный ключ: задайте SOLANA_MINT_AUTHORITY (JSON) или SOLANA_MINT_AUTHORITY_PATH (путь)')
}

async function ensureAta(
    connection: Connection,
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey,
    tx: Transaction
): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    const info = await connection.getAccountInfo(ata)
    if (!info) {
        tx.add(
            createAssociatedTokenAccountInstruction(
                payer,
                ata,
                owner,
                mint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        )
    }
    return ata
}

task('solana:spl:send', 'Mint или transfer SPL токенов с указанного приватного ключа')
    .addParam('action', 'Действие: mint | transfer')
    .addParam('mint', 'Адрес SPL mint (base58)')
    .addParam('to', 'Получатель (base58)')
    .addParam('amount', 'Количество (целые токены, без учета decimals)', undefined, types.int)
    .addOptionalParam('secret', 'Путь к файлу keypair JSON или сам JSON-массив секретного ключа. Если не указан — берется из SOLANA_MINT_AUTHORITY(/_PATH)')
    .addOptionalParam('rpc', 'RPC URL', process.env.RPC_URL_SOLANA_TESTNET ?? 'https://api.devnet.solana.com', types.string)
    .setAction(async (args: any, _hre: HardhatRuntimeEnvironment) => {
        const { action, mint, to, amount, secret, rpc } = args

        const connection = new Connection(rpc, 'confirmed')
        const authority = secret ? loadKeypairFromArg(secret) : loadKeypairFromEnv()
        const mintPk = new PublicKey(mint)
        const toPk = new PublicKey(to)

        // Собираем транзакцию
        const tx = new Transaction()

        if (action === 'mint') {
            const destAta = await ensureAta(connection, mintPk, toPk, authority.publicKey, tx)
            tx.add(createMintToInstruction(mintPk, destAta, authority.publicKey, BigInt(amount), [], TOKEN_PROGRAM_ID))
        } else if (action === 'transfer') {
            const fromAta = await ensureAta(connection, mintPk, authority.publicKey, authority.publicKey, tx)
            const destAta = await ensureAta(connection, mintPk, toPk, authority.publicKey, tx)
            tx.add(createTransferInstruction(fromAta, destAta, authority.publicKey, BigInt(amount), [], TOKEN_PROGRAM_ID))
        } else {
            throw new Error('action должен быть "mint" или "transfer"')
        }

        const sig = await sendAndConfirmTransaction(connection, tx, [authority])
        console.log('✅ tx signature:', sig)
    })


