# Makefile for 77bit Smart Contracts - Foundry

# Variables
FORGE = forge

# Output colors
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
BLUE = \033[0;34m
NC = \033[0m # No Color

# Load variables from .env file
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Function to update a variable in the .env file
define update_env_var
	@if [ -n "$(2)" ]; then \
		if grep -q "^$(1)=" .env; then \
			if [[ "$$OSTYPE" == "darwin"* ]]; then \
				sed -i '' "s|^$(1)=.*|$(1)=$(2)|" .env; \
			else \
				sed -i.bak "s|^$(1)=.*|$(1)=$(2)|" .env; \
			fi; \
		else \
			echo "$(1)=$(2)" >> .env; \
		fi; \
		echo "$(GREEN)✅ $(1) updated: $(2)$(NC)"; \
	fi
endef

# Function to extract address from deploy log and update .env
define extract_and_update_address
	@if grep -q "$(1)" $(2); then \
		ADDRESS=$$(grep "$(1)" $(2) | sed -E 's/.*$(1)[[:space:]]*//' | head -1 | tr -d '[:space:]'); \
		if [ -n "$$ADDRESS" ]; then \
			if grep -q "^$(3)=" .env; then \
				if [[ "$$OSTYPE" == "darwin"* ]]; then \
					sed -i '' "s|^$(3)=.*|$(3)=$$ADDRESS|" .env; \
				else \
					sed -i.bak "s|^$(3)=.*|$(3)=$$ADDRESS|" .env; \
				fi; \
			else \
				echo "$(3)=$$ADDRESS" >> .env; \
			fi; \
			echo "$(GREEN)✅ $(3) updated: $$ADDRESS$(NC)"; \
		else \
			echo "$(RED)❌ Failed to extract address for $(3)$(NC)"; \
		fi; \
	else \
		echo "$(YELLOW)⚠️  String '$(1)' not found in $(2)$(NC)"; \
	fi
endef

# Function to save all addresses from deploy log
define save_deployment_addresses
	@echo "$(BLUE)Saving contract addresses to .env...$(NC)"
	@$(call extract_and_update_address,SevenSevenBit Implementation:,/tmp/deploy.log,SEVEN_SEVEN_BIT_IMPL_ADDRESS)
	@$(call extract_and_update_address,SevenSevenBit Proxy:,/tmp/deploy.log,SEVEN_SEVEN_BIT_ADDRESS)
	@$(call extract_and_update_address,RagnarokTransform Implementation:,/tmp/deploy.log,TRANSFORM_IMPL_ADDRESS)
	@$(call extract_and_update_address,RagnarokTransform Proxy:,/tmp/deploy.log,TRANSFORM_CONTRACT_ADDRESS)
	@$(call extract_and_update_address,RagnarokMock:,/tmp/deploy.log,RONIN_CONTRACT_ADDRESS)
	@$(call extract_and_update_address,SecureLiquidDigitalChipMock:,/tmp/deploy.log,SLD_CHIP_CONTRACT_ADDRESS)
	@echo "$(GREEN)✅ All addresses saved to .env file!$(NC)"
endef

# Main commands
.PHONY: help install build test coverage deploy clean format lint size docs verify

# Show help
help:
	@echo "$(GREEN)77bit Smart Contracts - Foundry Makefile$(NC)"
	@echo ""
	@echo "$(BLUE)=== INSTALLATION & SETUP ===$(NC)"
	@echo "  setup-env        - Create .env file from template"
	@echo "  check-env        - Check environment variables"
	@echo "  install          - Install Foundry dependencies"
	@echo ""
	@echo "$(BLUE)=== COMPILATION ===$(NC)"
	@echo "  build            - Build contracts"
	@echo "  compile          - Compile contracts"
	@echo ""
	@echo "$(BLUE)=== TESTING ===$(NC)"
	@echo "  test             - Run tests"
	@echo "  test-gas         - Tests with gas report"
	@echo "  test-fuzz        - Fuzzing tests"
	@echo "  test-invariant   - Invariant tests"
	@echo "  coverage         - Test coverage"
	@echo "  snapshot         - Create test snapshot"
	@echo "  snapshot-update  - Update snapshots"
	@echo ""
	@echo ""
	@echo "$(BLUE)=== TEST SCRIPTS ===$(NC)"
	@echo "  approve-for-all-testnet-mocks     - approve for all mocks testnet"
	@echo "  art-upgrade-testnet-mocks         - art upgrade mocks testnet"
	@echo ""
	@echo "$(BLUE)=== DEPLOY ===$(NC)"
	@echo "  deploy           - Deploy to main network"
	@echo "  deploy-local     - Local deploy"
	@echo "  deploy-testnet   - Deploy to testnet"
	@echo "  deploy-mainnet   - Deploy to mainnet"
	@echo "  verify           - Verify contracts"
	@echo "  save-addresses   - Save addresses from deploy log"
	@echo ""
	@echo "$(BLUE)=== MOCKS DEPLOY ===$(NC)"
	@echo "  deploy-mocks           - Deploy to main network"
	@echo "  deploy-local-mocks     - Local deploy"
	@echo "  deploy-testnet-mocks   - Deploy to testnet"
	@echo "  deploy-mainnet-mocks   - Deploy to mainnet"
	@echo ""
	@echo "$(BLUE)=== UTILITIES ===$(NC)"
	@echo "  clean            - Clean artifacts"
	@echo "  format           - Format code"
	@echo "  lint             - Lint code"
	@echo "  size             - Contract sizes"
	@echo "  docs             - Generate documentation"
	@echo "  flatten          - Create flattened contract"
	@echo ""
	@echo "$(BLUE)=== QUICK COMMANDS ===$(NC)"
	@echo "  dev-setup        - Quick start for development"
	@echo "  full-test        - Full testing"
	@echo "  full-deploy      - Full deploy"
	@echo "  run              - Full cycle: clean, build, test, deploy"

# =============================================================================
# INSTALLATION & SETUP
# =============================================================================

# Install Foundry dependencies
install:
	@echo "$(BLUE)Installing Foundry dependencies...$(NC)"
	@if [ ! -d "lib/openzeppelin-contracts" ]; then \
		$(FORGE) install OpenZeppelin/openzeppelin-contracts; \
	fi
	@if [ ! -d "lib/openzeppelin-contracts-upgradeable" ]; then \
		$(FORGE) install OpenZeppelin/openzeppelin-contracts-upgradeable; \
	fi
	@if [ ! -d "lib/ERC721A-Upgradeable" ]; then \
		$(FORGE) install chiru-labs/ERC721A-Upgradeable; \
	fi
	@if [ ! -d "lib/forge-std" ]; then \
		$(FORGE) install foundry-rs/forge-std; \
	fi
	@echo "$(GREEN)✅ Foundry dependencies installed!$(NC)"

# Environment setup
setup-env:
	@echo "$(BLUE)Setting up environment...$(NC)"
	@if [ ! -f .env ]; then \
		cp env.example .env; \
		echo "$(GREEN)✅ .env file created from template$(NC)"; \
		echo "$(YELLOW)⚠️  Edit your .env file with your parameters$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  .env file already exists$(NC)"; \
	fi

# Check environment variables
check-env:
	@echo "$(BLUE)Checking environment variables...$(NC)"
	@if [ -f .env ]; then \
		echo "$(GREEN)✅ .env file found$(NC)"; \
		echo "$(YELLOW)Variables:$(NC)"; \
		grep -E "^(PRIVATE_KEY|RPC_URL|OWNER_ADDRESS)" .env | sed 's/=.*/=***/' || true; \
	else \
		echo "$(RED)❌ .env file not found. Run 'make setup-env'$(NC)"; \
	fi

# =============================================================================
# COMPILATION
# =============================================================================

# Build contracts
build:
	@echo "$(BLUE)Building contracts...$(NC)"
	$(FORGE) build
	@echo "$(GREEN)✅ Build complete!$(NC)"

# Compile contracts
compile: build

# =============================================================================
# TESTING
# =============================================================================

# Run tests
test:
	@echo "$(BLUE)Running tests...$(NC)"
	$(FORGE) test -vv
	@echo "$(GREEN)✅ Tests complete!$(NC)"

# Run tests with gas report
test-gas:
	@echo "$(BLUE)Running tests with gas report...$(NC)"
	$(FORGE) test --gas-report
	@echo "$(GREEN)✅ Gas report tests complete!$(NC)"

# Run fuzzing tests
test-fuzz:
	@echo "$(BLUE)Running fuzzing tests...$(NC)"
	$(FORGE) test --fuzz-runs 10000
	@echo "$(GREEN)✅ Fuzzing tests complete!$(NC)"

# Run invariant tests
test-invariant:
	@echo "$(BLUE)Running invariant tests...$(NC)"
	$(FORGE) test --invariant-runs 1000
	@echo "$(GREEN)✅ Invariant tests complete!$(NC)"

# Run test coverage
coverage:
	@echo "$(BLUE)Running test coverage...$(NC)"
	$(FORGE) coverage
	@echo "$(GREEN)✅ Test coverage complete!$(NC)"

# Create test snapshot
snapshot:
	@echo "$(BLUE)Creating test snapshot...$(NC)"
	$(FORGE) snapshot
	@echo "$(GREEN)✅ Snapshot created!$(NC)"

# Update snapshots
snapshot-update:
	@echo "$(BLUE)Updating snapshots...$(NC)"
	$(FORGE) snapshot --update
	@echo "$(GREEN)✅ Snapshots updated!$(NC)"

# =============================================================================
# DEPLOY
# =============================================================================

# Deploy to main network
deploy:
	@echo "$(BLUE)Deploying to main network...$(NC)"
	@if [ -z "$(RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ RPC_URL or PRIVATE_KEY not set in .env$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/Deploy.sol --rpc-url $(RPC_URL) --broadcast --verify 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Deploy complete!$(NC)"

# Local deploy
deploy-local:
	@echo "$(BLUE)Local deploy...$(NC)"
	$(FORGE) script script/Deploy.sol --rpc-url http://localhost:8545 --broadcast 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Local deploy complete!$(NC)"

# Deploy to testnet
deploy-testnet:
	@echo "$(BLUE)Deploying to testnet...$(NC)"
	@if [ -z "$(TESTNET_RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ TESTNET_RPC_URL or PRIVATE_KEY not set$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/Deploy.sol --rpc-url $(TESTNET_RPC_URL) --broadcast --verify 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Deploy to testnet complete!$(NC)"

# Deploy to mainnet
deploy-mainnet:
	@echo "$(BLUE)Deploying to mainnet...$(NC)"
	@if [ -z "$(MAINNET_RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ MAINNET_RPC_URL or PRIVATE_KEY not set$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/Deploy.sol --rpc-url $(MAINNET_RPC_URL) --broadcast --verify 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Deploy to mainnet complete!$(NC)"


# =============================================================================
# MOCKS DEPLOY
# =============================================================================

# Deploy to main network
deploy-mocks:
	@echo "$(BLUE)Deploying to main network...$(NC)"
	@if [ -z "$(RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ RPC_URL or PRIVATE_KEY not set in .env$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/DeployTransformWithMocks.sol --rpc-url $(RPC_URL) --broadcast --verify 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Deploy complete!$(NC)"

# Local deploy
deploy-local-mocks:
	@echo "$(BLUE)Local deploy...$(NC)"
	$(FORGE) script script/DeployTransformWithMocks.sol --rpc-url http://localhost:8545 --broadcast 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Local deploy complete!$(NC)"

# Deploy to testnet
deploy-testnet-mocks:
	@echo "$(BLUE)Deploying to testnet...$(NC)"
	@if [ -z "$(TESTNET_RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ TESTNET_RPC_URL or PRIVATE_KEY not set$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/DeployTransformWithMocks.sol --rpc-url $(TESTNET_RPC_URL) --broadcast --verify 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Deploy to testnet complete!$(NC)"


# approve for all mocks
approve-for-all-testnet-mocks:
	@echo "$(BLUE)Deploying to testnet...$(NC)"
	@if [ -z "$(TESTNET_RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ TESTNET_RPC_URL or PRIVATE_KEY not set$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/MintAndApprove.s.sol --rpc-url $(TESTNET_RPC_URL) --broadcast --verify
	@echo "$(GREEN)✅ Deploy to testnet complete!$(NC)"

# approve for all mocks
art-upgrade-testnet-mocks:
	@echo "$(BLUE)Deploying to testnet...$(NC)"
	@if [ -z "$(TESTNET_RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ TESTNET_RPC_URL or PRIVATE_KEY not set$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/ArtUpgrade.s.sol --rpc-url $(TESTNET_RPC_URL) --broadcast --verify
	@echo "$(GREEN)✅ Deploy to testnet complete!$(NC)"


# Deploy to mainnet
deploy-mainnet-mocks:
	@echo "$(BLUE)Deploying to mainnet...$(NC)"
	@if [ -z "$(MAINNET_RPC_URL)" ] || [ -z "$(PRIVATE_KEY)" ]; then \
		echo "$(RED)❌ MAINNET_RPC_URL or PRIVATE_KEY not set$(NC)"; \
		exit 1; \
	fi
	$(FORGE) script script/DeployTransformWithMocks.sol --rpc-url $(MAINNET_RPC_URL) --broadcast --verify 2>&1 | tee /tmp/deploy.log
	$(call save_deployment_addresses)
	@echo "$(GREEN)✅ Deploy to mainnet complete!$(NC)"

# =============================================================================
# UTILITIES
# =============================================================================

# Clean artifacts
clean:
	@echo "$(BLUE)Cleaning artifacts...$(NC)"
	$(FORGE) clean
	@echo "$(GREEN)✅ Artifacts cleaned!$(NC)"

# Format code
format:
	@echo "$(BLUE)Formatting code...$(NC)"
	$(FORGE) fmt
	@echo "$(GREEN)✅ Code formatted!$(NC)"

# Lint code
lint:
	@echo "$(BLUE)Linting code...$(NC)"
	$(FORGE) fmt --check
	@echo "$(GREEN)✅ Code linted!$(NC)"

# Contract sizes
size:
	@echo "$(BLUE)Contract sizes:$(NC)"
	$(FORGE) build --sizes

# Generate documentation
docs:
	@echo "$(BLUE)Generating documentation...$(NC)"
	$(FORGE) doc
	@echo "$(GREEN)✅ Documentation generated!$(NC)"

# Verify contracts
verify:
	@echo "$(BLUE)Verifying contracts...$(NC)"
	@if [ -z "$(CONTRACT_ADDRESS)" ] || [ -z "$(CONTRACT_NAME)" ] || [ -z "$(CHAIN_ID)" ] || [ -z "$(ETHERSCAN_API_KEY)" ]; then \
		echo "$(RED)❌ Set CONTRACT_ADDRESS, CONTRACT_NAME, CHAIN_ID, ETHERSCAN_API_KEY$(NC)"; \
		echo "$(YELLOW)Example: make verify CONTRACT_ADDRESS=0x... CONTRACT_NAME=ContractName CHAIN_ID=1$(NC)"; \
		exit 1; \
	fi
	$(FORGE) verify-contract $(CONTRACT_ADDRESS) $(CONTRACT_NAME) --chain-id $(CHAIN_ID) --etherscan-api-key $(ETHERSCAN_API_KEY)
	@echo "$(GREEN)✅ Contract verified!$(NC)"

# Save addresses from deploy log
save-addresses:
	@echo "$(BLUE)Saving addresses from deploy log...$(NC)"
	@if [ ! -f /tmp/deploy.log ]; then \
		echo "$(RED)❌ File /tmp/deploy.log not found$(NC)"; \
		echo "$(YELLOW)Run deploy first$(NC)"; \
		exit 1; \
	fi
	$(call save_deployment_addresses)

# Create flattened contract
flatten:
	@echo "$(BLUE)Creating flattened contract...$(NC)"
	@if [ -z "$(CONTRACT)" ]; then \
		echo "$(RED)❌ Set CONTRACT$(NC)"; \
		echo "$(YELLOW)Example: make flatten CONTRACT=SevenSevenBit$(NC)"; \
		exit 1; \
	fi
	$(FORGE) flatten src/$(CONTRACT).sol > flattened/$(CONTRACT).sol
	@echo "$(GREEN)✅ Flattened contract created!$(NC)"

# =============================================================================
# QUICK COMMANDS
# =============================================================================

# Quick start for development
dev-setup: setup-env install build
	@echo "$(GREEN)✅ Project ready for development!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Edit your .env file"
	@echo "  2. Run 'make test' to check"
	@echo "  3. Run 'make deploy-local' for local deploy"

# Full testing
full-test: test test-gas test-fuzz test-invariant coverage
	@echo "$(GREEN)✅ Full testing complete!$(NC)"

# Full deploy
full-deploy: deploy-local
	@echo "$(GREEN)✅ Full deploy complete!$(NC)"

# Full cycle
run: clean build full-test full-deploy
	@echo "$(GREEN)✅ Full cycle complete!$(NC)" 