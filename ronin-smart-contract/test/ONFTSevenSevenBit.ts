import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { LZEndpointMock, SevenSevenBit } from "../typechain-types"
import { Signer } from "ethers"

describe("ONFTSevenSevenBit: ", function () {
	// mocked chain ids
	const chainId_A = 1
	const chainId_B = 2
	const chainId_C = 3

	const minGasToStore = 40000
	const batchSizeLimit = 1
	const defaultAdapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000])
	const baseTokenURI = "https://example.com/token/"
	const addressZero = "0x0000000000000000000000000000000000000000"

	// mocked layer zero endpoints
	async function deployLZEndpoints() {
		const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
		const lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
		const lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)
		const lzEndpointMockC = await LZEndpointMock.deploy(chainId_C)
		return { lzEndpointMockA, lzEndpointMockB, lzEndpointMockC }
	}

	// deploy SevenSevenBit implementation contract
	async function deploySevenSevenBit(owner: Signer) {
		const sevenSevenBitFactory = await ethers.getContractFactory("SevenSevenBit")
		const sevenSevenBit = await upgrades.deployProxy(sevenSevenBitFactory, [await owner.getAddress(), baseTokenURI])
		return { sevenSevenBit }
	}

	// deploy ProxyONFT721 contract to chain A
	async function deployProxyONFT721(lzEndpointMockA: LZEndpointMock, tokenAddress: SevenSevenBit) {
		const proxyONFT721Factory = await ethers.getContractFactory("ONFTSevenSevenBitProxy")
		const ONFTSevenSevenBitProxy_A = await proxyONFT721Factory.deploy(
			minGasToStore,
			await lzEndpointMockA.getAddress(),
			await tokenAddress.getAddress()
		)
		return { ONFTSevenSevenBitProxy_A }
	}

	// deploy ONFT721 contracts to chain B and C
	async function deployONFT721(lzEndpointMockB: LZEndpointMock, lzEndpointMockC: LZEndpointMock) {
		const ONFT721Factory = await ethers.getContractFactory("ONFTSevenSevenBit")
		const ONFTSevenSevenBit_B = await ONFT721Factory.deploy(minGasToStore, await lzEndpointMockB.getAddress())
		const ONFTSevenSevenBit_C = await ONFT721Factory.deploy(minGasToStore, await lzEndpointMockC.getAddress())
		return { ONFTSevenSevenBit_B, ONFTSevenSevenBit_C }
	}

	// deploy, connect and configure all contracts
	async function deployContractsFixture() {
		const [owner, user, user2] = await ethers.getSigners()

		// deploy contracts
		const { lzEndpointMockA, lzEndpointMockB, lzEndpointMockC } = await deployLZEndpoints()
		const { sevenSevenBit } = await deploySevenSevenBit(owner)
		const { ONFTSevenSevenBitProxy_A } = await deployProxyONFT721(lzEndpointMockA, sevenSevenBit)
		const { ONFTSevenSevenBit_B, ONFTSevenSevenBit_C } = await deployONFT721(lzEndpointMockB, lzEndpointMockC)

		// get all addresses of lz endpoints
		const addressLzEndpointMockA = await lzEndpointMockA.getAddress()
		const addressLzEndpointMockB = await lzEndpointMockB.getAddress()
		const addressLzEndpointMockC = await lzEndpointMockC.getAddress()

		// get all addresses of contracts
		const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()
		const addressONFT721_B = await ONFTSevenSevenBit_B.getAddress()
		const addressONFT721_C = await ONFTSevenSevenBit_C.getAddress()

		// wire the lz endpoints to guide msgs back and forth
		await lzEndpointMockA.setDestLzEndpoint(addressONFT721_B, addressLzEndpointMockB)
		await lzEndpointMockA.setDestLzEndpoint(addressONFT721_C, addressLzEndpointMockC)
		await lzEndpointMockB.setDestLzEndpoint(addressproxyONFT721_A, addressLzEndpointMockA)
		await lzEndpointMockB.setDestLzEndpoint(addressONFT721_C, addressLzEndpointMockC)
		await lzEndpointMockC.setDestLzEndpoint(addressproxyONFT721_A, addressLzEndpointMockA)
		await lzEndpointMockC.setDestLzEndpoint(addressONFT721_B, addressLzEndpointMockB)

		// set each contracts source address so it can send to each other
		await ONFTSevenSevenBitProxy_A.setTrustedRemote(
			chainId_B,
			ethers.solidityPacked(["address", "address"], [addressONFT721_B, addressproxyONFT721_A])
		)
		await ONFTSevenSevenBitProxy_A.setTrustedRemote(
			chainId_C,
			ethers.solidityPacked(["address", "address"], [addressONFT721_C, addressproxyONFT721_A])
		)
		await ONFTSevenSevenBit_B.setTrustedRemote(
			chainId_A,
			ethers.solidityPacked(["address", "address"], [addressproxyONFT721_A, addressONFT721_B])
		)
		await ONFTSevenSevenBit_B.setTrustedRemote(
			chainId_C,
			ethers.solidityPacked(["address", "address"], [addressONFT721_C, addressONFT721_B])
		)
		await ONFTSevenSevenBit_C.setTrustedRemote(
			chainId_A,
			ethers.solidityPacked(["address", "address"], [addressproxyONFT721_A, addressONFT721_C])
		)
		await ONFTSevenSevenBit_C.setTrustedRemote(
			chainId_B,
			ethers.solidityPacked(["address", "address"], [addressONFT721_B, addressONFT721_C])
		)

		// set batch size limit
		await ONFTSevenSevenBitProxy_A.setDstChainIdToBatchLimit(chainId_B, batchSizeLimit)
		await ONFTSevenSevenBitProxy_A.setDstChainIdToBatchLimit(chainId_C, batchSizeLimit)
		await ONFTSevenSevenBit_B.setDstChainIdToBatchLimit(chainId_A, batchSizeLimit)
		await ONFTSevenSevenBit_B.setDstChainIdToBatchLimit(chainId_C, batchSizeLimit)
		await ONFTSevenSevenBit_C.setDstChainIdToBatchLimit(chainId_A, batchSizeLimit)
		await ONFTSevenSevenBit_C.setDstChainIdToBatchLimit(chainId_B, batchSizeLimit)

		// set min dst gas for swap
		await ONFTSevenSevenBitProxy_A.setMinDstGas(chainId_B, 1, 150000)
		await ONFTSevenSevenBitProxy_A.setMinDstGas(chainId_C, 1, 150000)
		await ONFTSevenSevenBit_B.setMinDstGas(chainId_A, 1, 150000)
		await ONFTSevenSevenBit_B.setMinDstGas(chainId_C, 1, 150000)
		await ONFTSevenSevenBit_C.setMinDstGas(chainId_A, 1, 150000)
		await ONFTSevenSevenBit_C.setMinDstGas(chainId_B, 1, 150000)

		return {
			lzEndpointMockA,
			lzEndpointMockB,
			lzEndpointMockC,
			sevenSevenBit,
			ONFTSevenSevenBitProxy_A,
			ONFTSevenSevenBit_B,
			ONFTSevenSevenBit_C,
			owner,
			user,
			user2,
		}
	}

	describe("LayerZero usage: ", function () {
		describe("sendFrom():", function () {
			it("Should send tokens between chains", async function () {
				const {
					sevenSevenBit,
					ONFTSevenSevenBitProxy_A,
					ONFTSevenSevenBit_B,
					ONFTSevenSevenBit_C,
					owner,
					user,
				} = await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()
				const addressONFT721_B = await ONFTSevenSevenBit_B.getAddress()
				const addressONFT721_C = await ONFTSevenSevenBit_C.getAddress()

				const tokenId = 1

				await sevenSevenBit.safeMint(owner.address, tokenId)

				// verify the owner of the token is on the source chain
				expect(await sevenSevenBit.ownerOf(tokenId)).to.be.equal(owner.address)

				// token doesn't exist on other chain
				await expect(ONFTSevenSevenBit_B.ownerOf(tokenId))
					.to.be.revertedWithCustomError(ONFTSevenSevenBit_B, "ERC721NonexistentToken")
					.withArgs(tokenId)

				// can transfer token on srcChain as regular erC721
				await sevenSevenBit.transferFrom(owner.address, user.address, tokenId)
				expect(await sevenSevenBit.ownerOf(tokenId)).to.be.equal(user.address)

				// approve the proxy to swap your token
				await sevenSevenBit.connect(user).approve(addressproxyONFT721_A, tokenId)

				// estimate nativeFees
				let nativeFee = (
					await ONFTSevenSevenBitProxy_A.estimateSendFee(
						chainId_B,
						user.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// swaps token to other chain
				await ONFTSevenSevenBitProxy_A.connect(user).sendFrom(
					user.address,
					chainId_B,
					user.address,
					tokenId,
					user.address,
					addressZero,
					defaultAdapterParams,
					{ value: nativeFee }
				)

				// token is now owned by the proxy contract, because this is the original nft chain
				expect(await sevenSevenBit.ownerOf(tokenId)).to.equal(addressproxyONFT721_A)

				// token received on the dst chain
				expect(await ONFTSevenSevenBit_B.ownerOf(tokenId)).to.be.equal(user.address)

				// estimate nativeFees
				nativeFee = (
					await ONFTSevenSevenBit_B.estimateSendFee(
						chainId_C,
						user.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// can send to other onft contract eg. not the original nft contract chain
				await ONFTSevenSevenBit_B.connect(user).sendFrom(
					user.address,
					chainId_C,
					user.address,
					tokenId,
					user.address,
					addressZero,
					defaultAdapterParams,
					{ value: nativeFee }
				)

				// token is burned on the sending chain
				expect(await ONFTSevenSevenBit_B.ownerOf(tokenId)).to.be.equal(addressONFT721_B)

				// token received on the dst chain
				expect(await ONFTSevenSevenBit_C.ownerOf(tokenId)).to.be.equal(user.address)

				// estimate nativeFees
				nativeFee = (
					await ONFTSevenSevenBit_C.estimateSendFee(
						chainId_A,
						user.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// send it back to the original chain
				await ONFTSevenSevenBit_C.connect(user).sendFrom(
					user.address,
					chainId_A,
					user.address,
					tokenId,
					user.address,
					addressZero,
					defaultAdapterParams,
					{ value: nativeFee }
				)

				// token is burned on the sending chain
				expect(await ONFTSevenSevenBit_C.ownerOf(tokenId)).to.be.equal(addressONFT721_C)

				// is received on the original chain
				expect(await sevenSevenBit.ownerOf(tokenId)).to.be.equal(user.address)
			})

			it("Should allow a token to be sent across chains on behalf of another user", async function () {
				const {
					sevenSevenBit,
					ONFTSevenSevenBitProxy_A,
					ONFTSevenSevenBit_B,
					ONFTSevenSevenBit_C,
					owner,
					user,
				} = await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()

				const tokenId = 1

				await sevenSevenBit.safeMint(owner.address, tokenId)

				// approve the proxy to swap your token
				await sevenSevenBit.approve(addressproxyONFT721_A, tokenId)

				// estimate nativeFees
				let nativeFee = (
					await ONFTSevenSevenBitProxy_A.estimateSendFee(
						chainId_B,
						owner.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// swaps token to other chain
				await ONFTSevenSevenBitProxy_A.sendFrom(
					owner.address,
					chainId_B,
					owner.address,
					tokenId,
					owner.address,
					addressZero,
					defaultAdapterParams,
					{
						value: nativeFee,
					}
				)

				// token received on the dst chain
				expect(await ONFTSevenSevenBit_B.ownerOf(tokenId)).to.be.equal(owner.address)

				// approve the other user to send the token
				await ONFTSevenSevenBit_B.approve(user.address, tokenId)

				// estimate nativeFees
				nativeFee = (
					await ONFTSevenSevenBit_B.estimateSendFee(
						chainId_C,
						user.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// sends across
				await ONFTSevenSevenBit_B.connect(user).sendFrom(
					owner.address,
					chainId_C,
					user.address,
					tokenId,
					user.address,
					addressZero,
					defaultAdapterParams,
					{ value: nativeFee }
				)

				// token received on the dst chain
				expect(await ONFTSevenSevenBit_C.ownerOf(tokenId)).to.be.equal(user.address)
			})

			it("Should revert if from is not msgSender", async function () {
				const { sevenSevenBit, ONFTSevenSevenBitProxy_A, owner, user } =
					await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()

				const tokenId = 1

				await sevenSevenBit.safeMint(owner.address, tokenId)

				// approve the proxy to swap your token
				await sevenSevenBit.approve(addressproxyONFT721_A, tokenId)

				// swaps token to other chain
				await expect(
					ONFTSevenSevenBitProxy_A.connect(user).sendFrom(
						owner.address,
						chainId_B,
						owner.address,
						tokenId,
						owner.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWith("ProxyONFT721: owner is not send caller")
			})

			it("Should revert if not approved on proxy", async function () {
				const { sevenSevenBit, ONFTSevenSevenBitProxy_A, owner } = await loadFixture(deployContractsFixture)

				const tokenId = 1

				await sevenSevenBit.safeMint(owner.address, tokenId)

				await expect(
					ONFTSevenSevenBitProxy_A.sendFrom(
						owner.address,
						chainId_B,
						owner.address,
						tokenId,
						owner.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWithCustomError(sevenSevenBit, "TransferCallerNotOwnerNorApproved")
			})

			it("Should revert when the contract is approved but the sending user is not", async function () {
				const { sevenSevenBit, ONFTSevenSevenBitProxy_A, ONFTSevenSevenBit_B, owner, user } =
					await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()
				const addressONFT721_B = await ONFTSevenSevenBit_B.getAddress()

				const tokenId = 1

				await sevenSevenBit.safeMint(owner.address, tokenId)

				// approve the proxy to swap your token
				await sevenSevenBit.approve(addressproxyONFT721_A, tokenId)

				// estimate nativeFees
				const nativeFee = (
					await ONFTSevenSevenBitProxy_A.estimateSendFee(
						chainId_B,
						owner.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// swaps token to other chain
				await ONFTSevenSevenBitProxy_A.sendFrom(
					owner.address,
					chainId_B,
					owner.address,
					tokenId,
					owner.address,
					addressZero,
					defaultAdapterParams,
					{
						value: nativeFee,
					}
				)

				// token received on the dst chain
				expect(await ONFTSevenSevenBit_B.ownerOf(tokenId)).to.be.equal(owner.address)

				// approve the contract to swap your token
				await ONFTSevenSevenBit_B.approve(addressONFT721_B, tokenId)

				// reverts because contract is approved, not the user
				await expect(
					ONFTSevenSevenBit_B.connect(user).sendFrom(
						owner.address,
						chainId_C,
						user.address,
						tokenId,
						user.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWith("ONFT721: send caller is not owner nor approved")
			})

			it("Should revert if not approved on non proxy chain", async function () {
				const { sevenSevenBit, ONFTSevenSevenBitProxy_A, ONFTSevenSevenBit_B, owner, user } =
					await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()

				const tokenId = 1

				await sevenSevenBit.safeMint(owner.address, tokenId)

				// approve the proxy to swap your token
				await sevenSevenBit.approve(addressproxyONFT721_A, tokenId)

				// estimate nativeFees
				const nativeFee = (
					await ONFTSevenSevenBitProxy_A.estimateSendFee(
						chainId_B,
						user.address,
						tokenId,
						false,
						defaultAdapterParams
					)
				).nativeFee

				// swaps token to other chain
				await ONFTSevenSevenBitProxy_A.sendFrom(
					owner.address,
					chainId_B,
					owner.address,
					tokenId,
					owner.address,
					addressZero,
					defaultAdapterParams,
					{
						value: nativeFee,
					}
				)

				// token received on the dst chain
				expect(await ONFTSevenSevenBit_B.ownerOf(tokenId)).to.be.equal(owner.address)

				// reverts because user is not approved
				await expect(
					ONFTSevenSevenBit_B.connect(user).sendFrom(
						owner.address,
						chainId_C,
						user.address,
						tokenId,
						user.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWith("ONFT721: send caller is not owner nor approved")
			})

			it("Should revert if someone else is approved, but not the sender", async function () {
				const { sevenSevenBit, ONFTSevenSevenBitProxy_A, owner, user } =
					await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()

				const tokenIdA = 1
				const tokenIdB = 2

				// safeMint to both owners
				await sevenSevenBit.safeMint(owner.address, tokenIdA)
				await sevenSevenBit.safeMint(user.address, tokenIdB)

				// approve owner.address to transfer, but not the other
				await sevenSevenBit.setApprovalForAll(addressproxyONFT721_A, true)

				await expect(
					ONFTSevenSevenBitProxy_A.connect(user).sendFrom(
						user.address,
						chainId_B,
						user.address,
						tokenIdB,
						user.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWithCustomError(sevenSevenBit, "TransferCallerNotOwnerNorApproved")
				await expect(
					ONFTSevenSevenBitProxy_A.connect(user).sendFrom(
						user.address,
						chainId_B,
						owner.address,
						tokenIdB,
						owner.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWithCustomError(sevenSevenBit, "TransferCallerNotOwnerNorApproved")
			})

			it("Should revert if sender does not own token", async function () {
				const { sevenSevenBit, ONFTSevenSevenBitProxy_A, owner, user } =
					await loadFixture(deployContractsFixture)

				// get all addresses of contracts
				const addressproxyONFT721_A = await ONFTSevenSevenBitProxy_A.getAddress()

				const tokenIdA = 1
				const tokenIdB = 2

				// safeMint to both owners
				await sevenSevenBit.safeMint(owner.address, tokenIdA)
				await sevenSevenBit.safeMint(user.address, tokenIdB)

				// approve owner.address to transfer, but not the other
				await sevenSevenBit.setApprovalForAll(addressproxyONFT721_A, true)

				await expect(
					ONFTSevenSevenBitProxy_A.connect(user).sendFrom(
						user.address,
						chainId_B,
						user.address,
						tokenIdA,
						user.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWithCustomError(sevenSevenBit, "TransferFromIncorrectOwner")
				await expect(
					ONFTSevenSevenBitProxy_A.connect(user).sendFrom(
						user.address,
						chainId_B,
						owner.address,
						tokenIdA,
						owner.address,
						addressZero,
						defaultAdapterParams
					)
				).to.be.revertedWithCustomError(sevenSevenBit, "TransferFromIncorrectOwner")
			})
		})
	})
})
