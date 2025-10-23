import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { Signer } from "ethers"
import { ethers, upgrades } from "hardhat"

describe("SevenSevenBit: ", function () {
	const baseTokenURI = "https://example.com/"

	async function deploySevenSevenBit(owner: Signer) {
		const sevenSevenBitFactory = await ethers.getContractFactory("SevenSevenBit")
		const sevenSevenBit = await upgrades.deployProxy(sevenSevenBitFactory, [await owner.getAddress(), baseTokenURI])
		return { sevenSevenBit }
	}

	async function deployContractsFixture() {
		const [owner, user, user2] = await ethers.getSigners()
		const { sevenSevenBit } = await deploySevenSevenBit(owner)
		return { sevenSevenBit, owner, user, user2 }
	}

	describe("Proxy and implementation: ", function () {
		describe("uri()", function () {
			it ("Should return the base URI", async function () {
				const { sevenSevenBit, user } = await loadFixture(deployContractsFixture)
				await sevenSevenBit.safeMint(user.address, 2)
				expect(await sevenSevenBit.tokenURI(1)).to.equal("https://example.com/1.json")

				await sevenSevenBit.setBaseTokenURI("https://example2.com/")
				expect(await sevenSevenBit.tokenURI(1)).to.equal("https://example2.com/1.json")
			})
		})

		describe("Deployment", function () {
			it("Should set the right owner", async function () {
				const { sevenSevenBit, owner } = await loadFixture(deployContractsFixture)
				expect(await sevenSevenBit.owner()).to.equal(owner.address)
			})

			it("Should set the correct base URI", async function () {
				const { sevenSevenBit } = await loadFixture(deployContractsFixture)
				expect(await sevenSevenBit.baseTokenURI()).to.equal(baseTokenURI)
			})
		})

		describe("Minting", function () {
			it("Should mint a new token to specified address", async function () {
				const { sevenSevenBit, user } = await loadFixture(deployContractsFixture)
				await sevenSevenBit.safeMint(user.address, 1)
				expect(await sevenSevenBit.balanceOf(user.address)).to.equal(1)
			})
		})

		describe("Upgradeability", function () {
			it("Should upgrade the contract and change implementation", async function () {
				const { sevenSevenBit } = await loadFixture(deployContractsFixture)
				const oldAddress = await sevenSevenBit.getAddress()

				expect(await sevenSevenBit.baseTokenURI()).to.equal(baseTokenURI)

				const v2 = await ethers.getContractFactory("SevenSevenBitMock")
				await upgrades.upgradeProxy(await sevenSevenBit.getAddress(), v2)

				expect(await sevenSevenBit.getAddress()).to.equal(oldAddress)
				expect(await sevenSevenBit.tokenURI(1)).to.equal("https://uri-from-v2/")
			})
		})
	})
})
