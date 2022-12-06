/* Tests for Whitelist contract
1 deployment
  1.1 maxWhitelistedAddresses is set correctly
  1.2 numAddressesWhitelisted starts at zero
2 whitelisting
  2.1 msg sender is whitelisted after successful addAddressToWhitelist call
  2.2 trying to call addAddressToWhitelist as someone who is already whitelisted fails
  2.3 no more than maxWhitelistedAddresses can whitelist: addAddressToWhitelist fails if max is 
    reached
  2.4 numAddressesWhitelisted is increased by one after successful addAddressToWhitelist call,
    respecting the set maxWhitelistedAddresses

*/
const { assert, expect } = require("chai");
const hre = require("hardhat");

describe("Tests for Whitelist contract", function () {
  const maxWhitelistedAddresses = 3;
  let deployedWhitelistContract;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    account2 = signers[1];
    account3 = signers[2];
    account4 = signers[3];

    const whitelistContract = await hre.ethers.getContractFactory("Whitelist");
    deployedWhitelistContract = await whitelistContract.deploy(
      maxWhitelistedAddresses
    );
  });

  it("deployment succeeds and sets expected data on contract", async function () {
    // Tests 1.1 and 1.2
    expect(await deployedWhitelistContract.maxWhitelistedAddresses()).to.equal(
      maxWhitelistedAddresses
    );
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      0
    );
  });

  it("msg sender is whitelisted after successful addAddressToWhitelist call", async function () {
    // Tests 2.1 and 2.4
    assert.isFalse(
      await deployedWhitelistContract.whitelistedAddresses(owner.address)
    );
    await deployedWhitelistContract.connect(owner).addAddressToWhitelist();
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      1
    );

    assert.isTrue(
      await deployedWhitelistContract.whitelistedAddresses(owner.address)
    );
  });

  it("trying to call addAddressToWhitelist as someone who is already whitelisted fails", async function () {
    // Tests 2.2
    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    await expect(
      deployedWhitelistContract.connect(account2).addAddressToWhitelist()
    ).to.be.revertedWith("Sender has already been whitelisted");
  });

  it("no more than maxWhitelistedAddresses can whitelist", async function () {
    // Tests 2.3
    await deployedWhitelistContract.connect(owner).addAddressToWhitelist();
    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    await deployedWhitelistContract.connect(account3).addAddressToWhitelist();
    await expect(
      deployedWhitelistContract.connect(account4).addAddressToWhitelist()
    ).to.be.revertedWith("More addresses cant be added, limit reached");
  });
});
