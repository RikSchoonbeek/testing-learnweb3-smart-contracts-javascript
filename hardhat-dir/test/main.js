// Deploy and interact with the different contracts in order of their
// interdependency:
// - Whitelist
// - CryptoDevs
// - CryptoDevToken

/* The following things are tested

Contract Whitelist
v deployment
  v maxWhitelistedAddresses is set correctly
  v numAddressesWhitelisted starts at zero
v whitelisting
  v msg sender is whitelisted after successful addAddressToWhitelist call
  v trying to call addAddressToWhitelist as someone who is already whitelisted fails
  v no more than maxWhitelistedAddresses can whitelist: addAddressToWhitelist fails if max is reached
  v numAddressesWhitelisted is increased by one after successful addAddressToWhitelist call,
    respecting the set maxWhitelistedAddresses

Contract CryptoDevs
- deployment
  v maxTokenCount correctly set
  - whitelist contract correctly set (this is tested indirectly with test during the presale tests,
    see below)
  v ERC721 constructor: name and symbol correctly set
  v sender of deploy transaction is set to contract owner
  - assertion that baseURI passed to constructor is handled correctly is done during presale,
    as we can then call tokenURI(tokenId) having our first tokenId
v pre presale
  v minting and presale minting don't work before presale is started
v presale initiation:
  v only owner of contract can start presale
  v presale can be started with presaleMint function
  v presaleStarted is set to true
  v presaleEnded is set to current block timestamp + 5 minutes
- during presale
  v normal mint is rejected during presale period
  v only whitelisted addresses can use presaleMint
  v no more than maxTokenCount can be minted in total
  v _price needs to be send with transaction in order for presaleMint to work
  v mintedTokenCount increased by one after successful presaleMint call
  - msg sender has one more Crypto Devs NFT after successful presaleMint call
  - presale ends at presaleEnded timestamp
  - contract can be set to paused or unpaused by calling setPaused
  - calling presaleMint is rejected if contract is paused
  - assert that tokenURI(tokenId) retuns expected URI (as baseURI is passed in constructor)
- after presale
  - calling presaleMint is rejected
  - no more than maxTokenCount can be minted in total
  - _price needs to be send with transaction in order for mint to work
  - mintedTokenCount increased by one after successful mint call
  - msg sender has one more Crypto Devs NFT after successful mint call
  - calling mint is rejected if contract is paused
  - contract can be set to paused or unpaused by calling setPaused
  - calling int is rejected if contract is paused
- withdraw
  - only owner of contract can call withdraw
  - after successful withdraw call ether from contract is transferred to owner address
- notes: the CryptoDevs contract inherits from OpenZeppeling ERC721Enumerable and Ownable
         ideally it would also be tested that these are implemented, somehow. But I guess
         a standard set of tests can be written for this and maybe already exist.

Contract CryptoDevToken
- deployment
  - CryptoDevs contract address is stored on contract correctly
  - ERC20 constructor: name and symbol correctly set
- claiming tokens using CryptoDevs NFTs
  - a CryptoDevs NFT holder receives CryptoDevToken.tokensPerNFT amount of tokens per unclaimed NFT they own,
    after a successful call to the claim function
  - if the caller of the claim function doesn't have any CryptoDevs NFTs:
    - their call will be rejected
    - they will receive no tokens from this transaction
  - if the caller of the claim function does have NFTs, but no unclaimed NFTs:
    - their call will be rejected
    - they will receive no tokens from this transaction
  - if the amount of NFTs held by the transaction sender equates more tokens than
    are available the transaction fails
- minting tokens
  - if the amount of ether sent is not equal to the amount required the transaction fails
  - if token mint amount + current total supply > max total supply, than the transaction fails
  - a successful claim call increases the transaction sender's balance with the amount being minted
- withdraw
  - only owner of contract can call withdraw
  - after successful withdraw call ether from contract is transferred to owner address
- notes: the CryptoDevToken contract inherits from OpenZeppeling ERC20 and Ownable
         ideally it would also be tested that these are implemented, somehow. But I guess
         a standard set of tests can be written for this and maybe already exist.
*/

const { assert, expect } = require("chai");
const hre = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

describe("Test the different contracts and their interoperability", function () {
  // I am setting up some variables here that are used in tests later
  let owner;
  let account2;
  let account3;
  let account4;

  // Used for Whitelist contract
  const maxWhitelistedAddresses = 3;

  // Used for CryptoDevs contract
  const baseURI = "https://www.example.com/";
  const maxTokenCount = 2;

  let deployedWhitelistContract;
  let deployedCryptoDevsContract;

  beforeEach(async function () {
    // - Deploys whitelist contract
    // - Deploy CryptoDevs NFT contract

    // Note to self: by default, deployments and function calls are done with the first configured account.
    // The ethers.getSigners() returns an array with all the configured accounts.
    const signers = await ethers.getSigners();
    owner = signers[0];
    account2 = signers[1];
    account3 = signers[2];
    account4 = signers[3];

    const whitelistContract = await hre.ethers.getContractFactory("Whitelist");
    // Deploy with max 3 whitelisted addresses
    deployedWhitelistContract = await whitelistContract.deploy(
      maxWhitelistedAddresses
    );

    // Deploy NFT contract
    const cryptoDevsContract = await hre.ethers.getContractFactory(
      "CryptoDevs"
    );
    deployedCryptoDevsContract = await cryptoDevsContract.deploy(
      baseURI,
      maxTokenCount,
      deployedWhitelistContract.address
    );
  });

  // Test for Whitelist contract
  it("Should whitelist as expected", async function () {
    // See notes above for overview of what is tested
    expect(await deployedWhitelistContract.maxWhitelistedAddresses()).to.equal(
      maxWhitelistedAddresses
    );
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      0
    );

    await deployedWhitelistContract.connect(owner).addAddressToWhitelist();
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      1
    );

    await expect(
      deployedWhitelistContract.connect(owner).addAddressToWhitelist()
    ).to.be.revertedWith("Sender has already been whitelisted");
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      1
    );

    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      2
    );
    await deployedWhitelistContract.connect(account3).addAddressToWhitelist();
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      maxWhitelistedAddresses
    );

    await expect(
      deployedWhitelistContract.connect(account4).addAddressToWhitelist()
    ).to.be.revertedWith("More addresses cant be added, limit reached");
    expect(await deployedWhitelistContract.numAddressesWhitelisted()).to.equal(
      3
    );
  });

  // Test for CryptoDevs contract
  it("Deployment of contract went as expected", async function () {
    expect(await deployedCryptoDevsContract.maxTokenCount()).to.equal(
      maxTokenCount
    );

    assert.equal(await deployedCryptoDevsContract.name(), "Crypto Devs");
    assert.equal(await deployedCryptoDevsContract.symbol(), "CD");

    const contractOwner = await deployedCryptoDevsContract.owner();
    assert.equal(contractOwner, owner.address);
  });

  it("Minting and presale minting don't work before presale is started", async function () {
    await expect(
      deployedCryptoDevsContract.connect(owner).presaleMint()
    ).to.be.revertedWith("Presale is not running");

    await expect(
      deployedCryptoDevsContract.connect(owner).mint()
    ).to.be.revertedWith("Presale has not ended yet");
  });

  it("Presale initiation meets requirements", async function () {
    assert.equal(await deployedCryptoDevsContract.presaleStarted(), false);
    await expect(
      deployedCryptoDevsContract.connect(account2).startPresale()
    ).to.be.revertedWith("Ownable: caller is not the owner");

    assert.equal(await deployedCryptoDevsContract.presaleStarted(), false);
    await deployedCryptoDevsContract.connect(owner).startPresale();
    assert.equal(await deployedCryptoDevsContract.presaleStarted(), true);

    // Note to self: https://hardhat.org/hardhat-network-helpers/docs/reference#increaseto(timestamp)
    const presaleStartedBlockTimeStamp = await helpers.time.latest();

    const presaleEndedTimeStamp =
      await deployedCryptoDevsContract.presaleEnded();
    const fiveMinutesInSeconds = 5 * 60;
    assert.equal(
      fiveMinutesInSeconds,
      presaleEndedTimeStamp - presaleStartedBlockTimeStamp
    );
  });

  // it("Presale period should meet the requirements", async function () {
  //   assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 0);
  //   await deployedCryptoDevsContract.connect(owner).startPresale();

  //   await expect(
  //     deployedCryptoDevsContract.connect(owner).mint()
  //   ).to.be.revertedWith("Presale has not ended yet");

  //   await expect(
  //     deployedCryptoDevsContract.connect(owner).presaleMint()
  //   ).to.be.revertedWith("You are not whitelisted");

  //   await deployedWhitelistContract.connect(owner).addAddressToWhitelist();
  //   await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
  //   await deployedWhitelistContract.connect(account3).addAddressToWhitelist();

  //   // Sending too much ether
  //   await expect(
  //     deployedCryptoDevsContract
  //       .connect(owner)
  //       .presaleMint({ value: ethers.utils.parseEther("0.015") })
  //   ).to.be.revertedWith("Ether sent is not correct");

  //   // Sending too little ether
  //   await expect(
  //     deployedCryptoDevsContract
  //       .connect(owner)
  //       .presaleMint({ value: ethers.utils.parseEther("0.005") })
  //   ).to.be.revertedWith("Ether sent is not correct");

  //   assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 0);

  //   await deployedCryptoDevsContract
  //     .connect(owner)
  //     .presaleMint({ value: ethers.utils.parseEther("0.01") });
  //   assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 1);
  //   await deployedCryptoDevsContract
  //     .connect(account2)
  //     .presaleMint({ value: ethers.utils.parseEther("0.01") });
  //   assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);

  //   await expect(
  //     deployedCryptoDevsContract
  //       .connect(account3)
  //       .presaleMint({ value: ethers.utils.parseEther("0.01") })
  //   ).to.be.revertedWith("Exceeded maximum Crypto Devs supply");
  //   assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);

  //   // // Increase time with 300 seconds to simulate presale ending
  //   // await helpers.time.increase(5 * 60);
  //   // await expect(
  //   //   deployedCryptoDevsContract.connect(owner).presaleMint()
  //   // ).to.be.revertedWith("Presale is not running");

  //   // // Make sure this works now, after presale ended
  //   // await deployedCryptoDevsContract
  //   //   .connect(owner)
  //   //   .mint({ value: ethers.utils.parseEther("1") });
  // });

  //   it("Should mint CryptoDev NFTs as expected", async function () {
  //     // mint and presaleMint should fail before presale has started
  //     await expect(
  //       deployedCryptoDevsContract.connect(owner).presaleMint()
  //     ).to.be.revertedWith("Presale is not running");

  //     await expect(
  //       deployedCryptoDevsContract.connect(owner).mint()
  //     ).to.be.revertedWith("Presale has not ended yet");

  //     await deployedCryptoDevsContract.connect(owner).startPresale();

  //     deployedCryptoDevsContract.connect(owner).presaleMint();
  //   });
});
