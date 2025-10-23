use anchor_lang::prelude::error_code;

#[error_code]
pub enum OAppError {
    InvalidMessageType,
    InvalidTokenDestination,
    RegistryEntryNotFound,
    RegistryMintMismatch,
    AlreadyClaimed,
    
}
