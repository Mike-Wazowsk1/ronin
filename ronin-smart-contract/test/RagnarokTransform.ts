import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { Signer } from "ethers"
import { ethers } from "hardhat"
import { RagnarokMock, SecureLiquidDigitalChipMock, SevenSevenBit } from "../typechain-types"

const baseSldChipTokenURI = "https://example.com/token/sld-chip/"
const baseRagnarokTokenURI = "https://example.com/token/ragnarok/"

describe("RagnarokTransform", function () {
	async function deployRagnarokMock(owner: Signer) {
		const ragnarokFactory = await ethers.getContractFactory("RagnarokMock")
		const ronin = await ragnarokFactory.connect(owner).deploy()
		return { ronin }
	}

	async function deploySldChipMock(owner: Signer) {
		const sldChipFactory = await ethers.getContractFactory("SecureLiquidDigitalChipMock")
		const sldChip = await sldChipFactory.connect(owner).deploy(baseSldChipTokenURI)
		await sldChip.connect(owner).addMinter(await owner.getAddress())
		return { sldChip }
	}

	async function deploySevenSevenBit(owner: Signer) {
		const sevenSevenBitFactory = await ethers.getContractFactory("SevenSevenBit")
		const sevenSevenBit = await sevenSevenBitFactory.connect(owner).deploy()
		await sevenSevenBit.initialize(await owner.getAddress(), baseRagnarokTokenURI)
		return { sevenSevenBit }
	}

	async function deployTransform(
		owner: Signer,
		ronin: RagnarokMock,
		sevenSevenBit: SevenSevenBit,
		sldChip: SecureLiquidDigitalChipMock
	) {
		const ragnarokTransformFactory = await ethers.getContractFactory("RagnarokTransform")

		const transform = await ragnarokTransformFactory.connect(owner).deploy()
		await transform.initialize(
			await ronin.getAddress(),
			await sevenSevenBit.getAddress(),
			await sldChip.getAddress()
		)

		return { transform }
	}

	async function setEthBalance(address: string, amount: number) {
		const amountInWei = "0x" + ethers.parseEther(amount.toString()).toString(16)
		await ethers.provider.send("hardhat_setBalance", [address, amountInWei])
		console.log("updated balance of ", address, "to", BigInt(amountInWei).toString())
	}

	async function createTestAccount(alias: string) {
		const account = await ethers.Wallet.createRandom(ethers.provider)
		console.log(`created account '${alias}': `, account.address)
		return account
	}

	async function deployContractsFixture() {
		const owner = await createTestAccount("owner")
		await setEthBalance(owner.address, 1)
		const testAccount1 = await createTestAccount("testAccount1")
		await setEthBalance(testAccount1.address, 1)
		const testAccount2 = await createTestAccount("testAccount2")
		await setEthBalance(testAccount2.address, 1)

		const { ronin } = await deployRagnarokMock(owner)
		const { sevenSevenBit } = await deploySevenSevenBit(owner)
		const { sldChip } = await deploySldChipMock(owner)
		const { transform } = await deployTransform(owner, ronin, sevenSevenBit, sldChip)
		return {
			ronin,
			sevenSevenBit,
			sldChip,
			transform,
			owner,
			testAccount1,
			testAccount2,
		}
	}

	describe("ArtUpgrade", function () {
		describe("Art Upgrade replaces Ronin tokens with 77bit tokens", async () => {
			it("One Ronin successfully upgraded", async function () {
				const { ronin, sevenSevenBit, transform, owner, testAccount1, testAccount2 } =
					await loadFixture(deployContractsFixture)

				const transformAddress = await transform.getAddress()
				await ronin.connect(owner).mint(testAccount1, 1, 1)
				await sevenSevenBit.connect(owner).addMinter(transformAddress)

				await ronin.connect(testAccount1).setApprovalForAll(transformAddress, true)
				await transform.connect(testAccount1).artUpgrade([1])

				expect(await ronin.balanceOf(testAccount1, 1)).to.equal(0)
				expect(await sevenSevenBit.balanceOf(testAccount1)).to.equal(1)
			})

			it("Multiple Ronins with amount 1", async function () {
				const { ronin, sevenSevenBit, transform, owner, testAccount1, testAccount2 } =
					await loadFixture(deployContractsFixture)

				const transformAddress = await transform.getAddress()
				await ronin.connect(owner).mint(testAccount1, 1, 1)
				await ronin.connect(owner).mint(testAccount1, 2, 1)
				await ronin.connect(owner).mint(testAccount1, 3, 1)
				await sevenSevenBit.connect(owner).addMinter(transformAddress)

				await ronin.connect(testAccount1).setApprovalForAll(transformAddress, true)
				await transform.connect(testAccount1).artUpgrade([1, 2, 3])

				expect(await ronin.balanceOf(testAccount1, 1)).to.equal(0)
				expect(await ronin.balanceOf(testAccount1, 2)).to.equal(0)
				expect(await ronin.balanceOf(testAccount1, 3)).to.equal(0)
				expect(await sevenSevenBit.balanceOf(testAccount1)).to.equal(3)
			})
		})

		it("Art Upgrade should fail if RagnarokTransform contract " +
			"is not registered as a minter in SevenSevenBit contract", async function () {
			const { ronin, sevenSevenBit, transform, owner, testAccount1 } = await loadFixture(deployContractsFixture)
			const transformAddress = await transform.getAddress()
			await ronin.connect(owner).mint(testAccount1, 1, 1)
			await ronin.connect(testAccount1).setApprovalForAll(transformAddress, true)
			await sevenSevenBit.connect(owner).removeMinter(transformAddress)

			await expect(transform.connect(testAccount1).artUpgrade([1])).to.be
				.revertedWith("the caller has not permission to mint tokens")
		})

		it("ArtUpgrade should fail when TransformContract has not approval for user's ronins", async function () {
			const { ronin, sevenSevenBit, transform, owner, testAccount1 } = await loadFixture(deployContractsFixture)
			const transformAddress = await transform.getAddress()
			await ronin.connect(owner).mint(testAccount1, 1, 1)
			await ronin.connect(testAccount1).setApprovalForAll(transformAddress, false)
			await sevenSevenBit.connect(owner).addMinter(transformAddress)

			await expect(transform.connect(testAccount1).artUpgrade([1]))
				.to.be.revertedWithCustomError(ronin, "ERC1155MissingApprovalForAll")
				.withArgs(transformAddress, await testAccount1.getAddress())
		})

		it("Should not allow user to transform few types Ronin to 77bit if they don't have enough Ronin", async function () {
			const { ronin, sevenSevenBit, transform, owner, testAccount1 } = await loadFixture(deployContractsFixture)

			const anotherAddress = await testAccount1.getAddress()
			const transformAddress = await transform.getAddress()

			// Mint only Ronin 1 and 2 to testAccount1, amount = 1 for each
			for (let i = 1; i <= 2; i++) {
				await ronin.connect(owner).mint(testAccount1, i, 1)
			}

			// Approve transform contract to spend Ronin from testAccount1
			await ronin.connect(testAccount1).setApprovalForAll(transformAddress, true)

			// Try to perform the transformation and expect the transaction to be reverted
			const transformTx = transform.connect(testAccount1).artUpgrade([1, 2, 3])
			await expect(transformTx).to.be.revertedWith("Not enough token balance")

			// Verify Ronin were not burned
			for (let i = 1; i <= 2; i++) {
				const roninBalance = await ronin.balanceOf(anotherAddress, i)
				expect(roninBalance).to.equal(1)
			}

			// Verify 77bit were not minted
			expect(await sevenSevenBit.balanceOf(anotherAddress)).to.equal(0)
		})
	})

	// we cannot know token ids before mint so have to iterate over all possible ids to find the ones owned by the address
	async function find77IdsBitOwnedByAddress(sevenSevenBit: SevenSevenBit, address: string, limit: number) {
		const tokenIds = []
		for (let i = 1; i <= limit; i++) {
			try {
				const owner = await sevenSevenBit.ownerOf(i)
				if (owner === address) {
					tokenIds.push(i)
				}
			} catch (e) {
				console.log("failed to get owner of 77bit token id: ", i, e)
			}
		}
		if (tokenIds.length < limit) {
			throw new Error(`found only ${tokenIds.length} 77bit tokens owned by ${address}, expected ${limit}`)
		}
		return tokenIds
	}

	describe("Re-Roll", function () {
		describe("Re-Roll should transfer SldChips to the Transform contract owner address and produce the ReRoll event for given 77bit tokens", () => {
			it("One 77bit token successfully re-rolled with a chip", async function () {
				const { sldChip, sevenSevenBit, transform, owner, testAccount1 } =
					await loadFixture(deployContractsFixture)

				const anotherAddress = testAccount1.address

				// minting 77bit token to anotherAddress
				await sevenSevenBit.connect(owner).safeMint(anotherAddress, 1)

				const tokenId = (await find77IdsBitOwnedByAddress(sevenSevenBit, anotherAddress, 1))[0]

				// minting SldChip to anotherAddress
				await sldChip.connect(owner).mint([anotherAddress], [1], [1])

				// approve transform contract to spend SldChip from anotherAddress
				const transformAddress = await transform.getAddress()
				await sldChip.connect(testAccount1).setApprovalForAll(transformAddress, true)

				await transform.connect(testAccount1).reRoll([tokenId], [1])

				expect(await sldChip.balanceOf(anotherAddress, 1)).to.equal(0)
				expect(await sldChip.balanceOf(owner, 1)).to.equal(1)
				expect(await sevenSevenBit.balanceOf(anotherAddress)).to.equal(1)
			})

			it("One 77bit token successfully re-rolled without a chip", async function () {
				const { sevenSevenBit, transform, owner, testAccount1 } = await loadFixture(deployContractsFixture)

				const anotherAddress = testAccount1.address

				// minting 77bit token to anotherAddress
				await sevenSevenBit.connect(owner).safeMint(anotherAddress, 1)

				const tokenId = (await find77IdsBitOwnedByAddress(sevenSevenBit, anotherAddress, 1))[0]

				await transform.connect(testAccount1).reRoll([tokenId], [0])

				expect(await sevenSevenBit.balanceOf(anotherAddress)).to.equal(1)
			})

			it("Multiple 77bit tokens successfully re-rolled with chips", async function () {
				const { sldChip, sevenSevenBit, transform, owner, testAccount1 } =
					await loadFixture(deployContractsFixture)

				const anotherAddress = testAccount1.address
				await sevenSevenBit.connect(owner).safeMint(anotherAddress, 3)
				const tokenIds = await find77IdsBitOwnedByAddress(sevenSevenBit, anotherAddress, 3)
				await sldChip.connect(owner).mint([anotherAddress, anotherAddress, testAccount1], [1, 2, 3], [1, 1, 1])
				expect(await sldChip.balanceOf(anotherAddress, 1)).to.equal(1)
				expect(await sldChip.balanceOf(anotherAddress, 2)).to.equal(1)
				expect(await sldChip.balanceOf(anotherAddress, 3)).to.equal(1)

				const transformAddress = await transform.getAddress()
				await sldChip.connect(testAccount1).setApprovalForAll(transformAddress, true)
				await transform.connect(testAccount1).reRoll(tokenIds, [1, 2, 3])

				expect(await sldChip.balanceOf(anotherAddress, 1)).to.equal(0)
				expect(await sldChip.balanceOf(anotherAddress, 2)).to.equal(0)
				expect(await sldChip.balanceOf(anotherAddress, 3)).to.equal(0)
				expect(await sldChip.balanceOf(owner, 1)).to.equal(1)
				expect(await sldChip.balanceOf(owner, 2)).to.equal(1)
				expect(await sldChip.balanceOf(owner, 3)).to.equal(1)
				expect(await sevenSevenBit.balanceOf(anotherAddress)).to.equal(3)
			})

			it("Multiple 77bit tokens successfully re-rolled without chips", async function () {
				const { sevenSevenBit, transform, owner, testAccount1 } = await loadFixture(deployContractsFixture)

				const anotherAddress = testAccount1.address
				await sevenSevenBit.connect(owner).safeMint(anotherAddress, 3)
				const tokenIds = await find77IdsBitOwnedByAddress(sevenSevenBit, anotherAddress, 3)

				await transform.connect(testAccount1).reRoll(tokenIds, [0, 0, 0])

				expect(await sevenSevenBit.balanceOf(anotherAddress)).to.equal(3)
			})
		})
	})
})
