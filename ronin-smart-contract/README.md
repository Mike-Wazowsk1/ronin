# 77bit Smart Contracts

## Overview

This repository contains the smart contracts for the 77bit project:

- **SevenSevenBit**: ERC721A contract representing the new NFT collection for the 77bit.com project. Total supply is limited to 7777 tokens. The contract is upgradeable (UUPS proxy) and LayerZero-compatible (see the `77bit-layerzero` extension).
- **RagnarokTransform**: Contract that allows users to upgrade their old Ragnarok NFTs to new SevenSevenBit NFTs. Handles burning, minting, and re-rolls with SecureLiquidDigitalChip tokens.
- **ONFTSevenSevenBit**: LayerZero ONFT721 contract for cross-chain operations.
- **Mock contracts**: For testing (RagnarokMock, SecureLiquidDigitalChipMock, SevenSevenBitMock).
- **LayerZero contracts**: For prototyping and cross-chain functionality.

## Usage

### Prerequisites

- [Foundry](https://getfoundry.sh/) (latest version)
- Git

### Quickstart

1. **Clone the repository:**

```bash
git clone <repository-url>
cd 77bit-reveal-transform-smart-contracts
```

2. **Install dependencies and setup environment:**

```bash
make dev-setup
```

Or step-by-step:

```bash
make setup-env   # Prepare .env file
make install     # Install dependencies
```

3. **Build contracts:**

```bash
make build
```

4. **Run tests:**

```bash
make test        # Run main test suite
make full-test   # Run all test types (unit, integration, fuzz, invariant)
make test-gas    # Run gas report tests
make test-fuzz   # Run fuzzing tests
make test-invariant # Run invariant tests
make coverage    # Run test coverage
```

5. **Deploy contracts:**

```bash
make deploy-local     # Deploy to local network
make deploy-testnet   # Deploy to testnet
make deploy-mainnet   # Deploy to mainnet
```

After each deployment, contract addresses are automatically saved to the `.env` file.

6. **Manual address saving (if needed):**

```bash
make save-addresses
```

7. **Other useful commands:**

```bash
make clean        # Clean build artifacts
make format       # Format code
make lint         # Lint code
make flatten CONTRACT=SevenSevenBit # Create flat version of contract
make docs         # Generate documentation
make size         # Check contract sizes
```

### Environment Setup

- Copy `.env.example` to `.env` and fill in the required variables (private key, RPC URLs, etc).
- Make sure you have enough ETH on your deployer account for testnet/mainnet deployments.

### Project Structure

- `src/` — Solidity contracts
- `test/` — Foundry and TypeScript tests
- `script/` — Deployment scripts
- `lib/` — Dependencies
- `Makefile` — Main project commands

## Example: Full ArtUpgrade Cycle via Console

Below is a step-by-step guide to run the full artUpgrade cycle using Foundry scripts and the console:

1. **Deploy contracts with mocks:**

```bash
make deploy-testnet-mocks
```

Copy the addresses from the output and set them in your `.env` file:
```
TRANSFORM_CONTRACT_ADDRESS=0x...
RONIN_CONTRACT_ADDRESS=0x...
OWNER_ADDRESS=0x...         # Address to receive minted tokens
ART_UPGRADE_TOKEN_ID=1     # Token ID to mint and upgrade
MINT_AMOUNT=1
ROYALTY_FEE=1000000000000000  # Set according to your contract config
```

2. **Mint Ronin token and approve transform contract:**

```bash
make approve-for-all-testnet-mocks 
```

3. **Call artUpgrade:**

```bash
make art-upgrade-testnet-mocks
```

4. **Check balances and ownership (optional):**

You can write a simple script or use tests to check the result:
- Ronin token should be burned from USER_ADDRESS
- SevenSevenBit token should be minted to USER_ADDRESS

---

## Calling Any Function on Any Contract via `cast`

You can call any function of any deployed contract using the `cast` tool from Foundry.  
This is useful for manual interaction, debugging, or scripting.

### Prerequisites

- Make sure you have [Foundry](https://getfoundry.sh/) installed and available in your PATH.
- Set up your `.env` file with the correct `PRIVATE_KEY` and `RPC_URL` (or use `--private-key` and `--rpc-url` flags directly).

### Example Usage

#### 1. **Read-only (call) function**

To call a view/pure function (does not require gas):

```bash
cast call <CONTRACT_ADDRESS> "<FUNCTION_SIGNATURE>" --rpc-url <RPC_URL>
```

**Example:**  
Get the owner of an ERC721 token:

```bash
cast call 0xYourContractAddress "ownerOf(uint256)" 1 --rpc-url https://mainnet.infura.io/v3/your-key
```

#### 2. **State-changing (send) function**

To send a transaction (requires gas and private key):

```bash
cast send <CONTRACT_ADDRESS> "<FUNCTION_SIGNATURE>" [args...] --private-key <PRIVATE_KEY> --rpc-url <RPC_URL>
```

**Example:**  
Approve another address for a token:

```bash
cast send 0xYourContractAddress "approve(address,uint256)" 0xSpenderAddress 1 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

#### 3. **Calling any function on any contract**

- Replace `<CONTRACT_ADDRESS>` with the address of your contract.
- Replace `<FUNCTION_SIGNATURE>` with the Solidity function signature, e.g. `"mint(address,uint256)"`.
- Add arguments after the signature as needed.

**Tip:**  
You can use environment variables from your `.env` file for addresses and keys.

#### 4. **More examples**

- Call a function with no arguments:
  ```bash
  source .env && cast call 0xYourContractAddress "totalSupply()" --rpc-url $RPC_URL
  ```

- Call a function with multiple arguments:
  ```bash
  source .env && cast call 0xYourContractAddress "balanceOf(address)" 0xUserAddress --rpc-url $RPC_URL
  ```

- Send a transaction to mint a token:
  ```bash
  source .env && cast send 0xYourContractAddress "mint(address,uint256)" 0xUserAddress 1 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
  ```

---

**See more:**  
- [Foundry Book: cast](https://book.getfoundry.sh/reference/cast/cast.html)
- Run `cast --help` for all available options.

---
