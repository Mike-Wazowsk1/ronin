use anchor_lang::prelude::error_code;
use std::str;

// Simple string codec with 32-byte header (big-endian length in last 4 bytes)


// Layout:
// 0..28: zero padding
// 28..32: u32 length (BE)
// 32..(32+len): UTF-8 bytes


// We prefix the encoded string with a 32 byte length header.
pub const LENGTH_OFFSET: usize = 0;
pub const STRING_OFFSET: usize = 32;

#[error_code]
pub enum MsgCodecError {
    /// Buffer too short to even contain the 32‐byte length header
    InvalidLength,
    /// Header says "string is N bytes" but buffer < 32+N
    BodyTooShort,
    /// Payload bytes aren’t valid UTF-8
    InvalidUtf8,
}

/// Extract the string length
fn decode_string_len(buf: &[u8]) -> Result<usize, MsgCodecError> {
    // Header not long enough
    if buf.len() < STRING_OFFSET {
        return Err(MsgCodecError::InvalidLength);
    }
    let mut string_len_bytes = [0u8;32];
    string_len_bytes.copy_from_slice(&buf[LENGTH_OFFSET..LENGTH_OFFSET+32]);
    // The length is stored in the last 4 bytes (big endian)
    Ok(u32::from_be_bytes(string_len_bytes[28..32].try_into().unwrap()) as usize)
}

// Encode a UTF-8 string into a message format with a 32 byte header
pub fn encode(string: &str) -> Vec<u8> {
    let string_bytes = string.as_bytes();
    let mut msg = Vec::with_capacity(
        STRING_OFFSET +               // header length
        string_bytes.len()            // string bytes
    );

    // 4 byte length stored at the end of the 32 byte header
    msg.extend(std::iter::repeat(0).take(28)); // padding
    msg.extend_from_slice(&(string_bytes.len() as u32).to_be_bytes());

    // string
    msg.extend_from_slice(string_bytes);

    msg
}

// Decode a message format with a 32 byte header into a UTF-8 string
// Returns an error if the message is malformed or not valid UTF-8
pub fn decode(message: &[u8]) -> Result<String, MsgCodecError> {
    // Read the declared payload length from the header
    let string_len = decode_string_len(message)?;

    let start = STRING_OFFSET;
    // Safely compute end index and check for overflow
    let end = start
        .checked_add(string_len)
        .ok_or(MsgCodecError::InvalidLength)?;

    // Ensure the buffer actually contains the full payload
    if end > message.len() {
        return Err(MsgCodecError::BodyTooShort);
    }

    // Slice out the payload bytes
    let payload = &message[start..end];
    // Attempt to convert the bytes into a Rust string
    match str::from_utf8(payload) {
        Ok(s) => Ok(s.to_string()),
        Err(_) => Err(MsgCodecError::InvalidUtf8),
    }
}

// -----------------------------
// ONFT payload decoding helpers
// Layout: [to(32)][id(32)][amount(8 BE)] [+ optional compose bytes]
// -----------------------------

pub const ONFT_TO_OFFSET: usize = 0;
pub const ONFT_ID_OFFSET: usize = 32;
pub const ONFT_AMOUNT_OFFSET: usize = 64;
pub const ONFT_MIN_LEN: usize = 72; // 32 + 32 + 8
pub const ONFT_MINT_LEN: usize = 32;

#[derive(Clone, Debug)]
pub struct OnftPayload {
    pub to: [u8; 32],
    pub id: [u8; 32],
    pub amount: u64,
}

pub fn decode_onft(message: &[u8]) -> Result<OnftPayload, MsgCodecError> {
    if message.len() < ONFT_MIN_LEN {
        return Err(MsgCodecError::BodyTooShort);
    }

    let mut to = [0u8; 32];
    to.copy_from_slice(&message[ONFT_TO_OFFSET..ONFT_ID_OFFSET]);

    let mut id = [0u8; 32];
    id.copy_from_slice(&message[ONFT_ID_OFFSET..ONFT_AMOUNT_OFFSET]);

    let mut amount_be = [0u8; 8];
    amount_be.copy_from_slice(&message[ONFT_AMOUNT_OFFSET..ONFT_MIN_LEN]);
    let amount = u64::from_be_bytes(amount_be);

    Ok(OnftPayload { to, id, amount })
}

// Encode ONFT payload matching the EVM adapter format
pub fn encode_onft(to: &[u8; 32], id: &[u8; 32], amount: u64) -> Vec<u8> {
    let mut out = Vec::with_capacity(ONFT_MIN_LEN);
    out.extend_from_slice(to);
    out.extend_from_slice(id);
    out.extend_from_slice(&amount.to_be_bytes());
    out
}

pub fn decode_onft_mint(message: &[u8]) -> Option<[u8; 32]> {
    if message.len() >= ONFT_MIN_LEN + ONFT_MINT_LEN {
        let mut mint = [0u8; 32];
        mint.copy_from_slice(&message[ONFT_MIN_LEN..ONFT_MIN_LEN + ONFT_MINT_LEN]);
        Some(mint)
    } else {
        None
    }
}

// Fallback: compact format with token_id only (32 bytes)
// Layout: [id(32)]
// removed: decode_onft_id_only (legacy compact id-only format)
