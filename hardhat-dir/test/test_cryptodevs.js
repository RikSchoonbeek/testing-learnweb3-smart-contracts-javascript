/* Tests for CryptoDevs contract and its interaction with the Whitelist contract
1 deployment
  1.1 maxTokenCount correctly set
  1.2 whitelist contract correctly set (this is tested indirectly with test during the presale tests,
      see below)
  1.3 ERC721 constructor: name and symbol correctly set
  1.4 sender of deploy transaction is set to contract owner
  1.5 assertion that baseURI passed to constructor is handled correctly, tested indirectly
      by minting a token and calling tokenURI(tokenId)
2 pre presale
  2.1 minting and presale minting don't work before presale is started
3 presale initiation:
  3.1 only owner of contract can start presale
  3.2 presale can be started with presaleMint function
  3.3 presaleStarted is set to true
  3.4 presaleEnded is set to current block timestamp + 5 minutes
4 during presale
  4.1 normal mint is rejected during presale period
  4.2 only whitelisted addresses can use presaleMint
  4.3 no more than maxTokenCount can be minted in total
  4.4 _price needs to be send with transaction in order for presaleMint to work
  4.5 mintedTokenCount increased by one after successful presaleMint call
  4.6 msg sender has one more Crypto Devs NFT after successful presaleMint call
  4.7 presale ends at presaleEnded timestamp
  4.8 contract can be set to paused or unpaused by calling setPaused
  4.9 only owner of contract can pause and unpause contract
  4.10 calling presaleMint is rejected if contract is paused
5 after presale
  5.1 calling presaleMint is rejected
  5.2 _price needs to be send with transaction in order for mint to work
  5.3 mintedTokenCount increased by one after successful mint call
  5.4 msg sender has one more Crypto Devs NFT after successful mint call
  5.5 no more than maxTokenCount can be minted in total
  5.6 calling mint is rejected if contract is paused
  5.7 contract can be set to paused or unpaused by calling setPaused
  5.8 only owner of contract can pause and unpause contract
6 withdraw
  6.1 only owner of contract can call withdraw
  6.2 after successful withdraw call ether from contract is transferred to owner address
- notes: the CryptoDevs contract inherits from OpenZeppeling ERC721Enumerable and Ownable
         ideally it would also be tested that these are implemented, somehow. But I guess
         a standard set of tests can be written for this and maybe already exist.
*/

const { assert, expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

describe("Tests for CryptoDevs contract and its interaction with the Whitelist contract", function () {
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
    const signers = await ethers.getSigners();
    owner = signers[0];
    account2 = signers[1];
    account3 = signers[2];
    account4 = signers[3];

    const whitelistContract = await hre.ethers.getContractFactory("Whitelist");
    deployedWhitelistContract = await whitelistContract.deploy(
      maxWhitelistedAddresses
    );

    const cryptoDevsContract = await hre.ethers.getContractFactory(
      "CryptoDevs"
    );
    deployedCryptoDevsContract = await cryptoDevsContract.deploy(
      baseURI,
      maxTokenCount,
      deployedWhitelistContract.address
    );
  });

  it("1 deployment succeeds and sets expected data on contract", async function () {
    // Tests 1 fully
    assert.equal(
      await deployedCryptoDevsContract.maxTokenCount(),
      maxTokenCount
    );
    assert.equal(await deployedCryptoDevsContract.name(), "Crypto Devs");
    assert.equal(await deployedCryptoDevsContract.symbol(), "CD");

    const contractOwner = await deployedCryptoDevsContract.owner();
    assert.equal(contractOwner, owner.address);

    // Testing 1.2: calling presaleMint successfully and unsuccessfully requires
    // a successful connection with the Whitelist contract
    await deployedWhitelistContract.connect(owner).addAddressToWhitelist();
    await deployedCryptoDevsContract.connect(owner).startPresale();
    await deployedCryptoDevsContract
      .connect(owner)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });
    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .presaleMint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("You are not whitelisted");

    // Testing 1.5
    const ownerTokenIndex = 0; // Index is known as owner has only one token
    const ownerTokenId = await deployedCryptoDevsContract
      .connect(owner)
      .tokenOfOwnerByIndex(owner.address, ownerTokenIndex);
    const tokenURI = await deployedCryptoDevsContract
      .connect(owner)
      .tokenURI(ownerTokenId);
    assert.equal(`https://www.example.com/${ownerTokenId}`, tokenURI);
  });

  it("2 pre presale: minting and presale minting don't work before presale is started", async function () {
    await expect(
      deployedCryptoDevsContract.connect(owner).presaleMint()
    ).to.be.revertedWith("Presale is not running");

    await expect(
      deployedCryptoDevsContract.connect(owner).mint()
    ).to.be.revertedWith("Presale has not ended yet");
  });

  it("3 presale initiation", async function () {
    // Tests 3 fully
    assert.equal(await deployedCryptoDevsContract.presaleStarted(), false);
    assert.equal(await deployedCryptoDevsContract.presaleEnded(), 0);

    await expect(
      deployedCryptoDevsContract.connect(account2).startPresale()
    ).to.be.revertedWith("Ownable: caller is not the owner");

    assert.equal(await deployedCryptoDevsContract.presaleStarted(), false);
    assert.equal(await deployedCryptoDevsContract.presaleEnded(), 0);

    await deployedCryptoDevsContract.connect(owner).startPresale();
    const presaleStartedBlockTimeStamp = await helpers.time.latest();

    assert.equal(await deployedCryptoDevsContract.presaleStarted(), true);
    const presaleEndedTimeStamp =
      await deployedCryptoDevsContract.presaleEnded();
    const fiveMinutesInSeconds = 5 * 60;
    assert.equal(
      fiveMinutesInSeconds,
      presaleEndedTimeStamp - presaleStartedBlockTimeStamp
    );
  });

  it("4 during presale 4.1, 4.2 and 4.3", async function () {
    await deployedCryptoDevsContract.connect(owner).startPresale();

    await expect(
      deployedCryptoDevsContract.connect(owner).mint()
    ).to.be.revertedWith("Presale has not ended yet");

    await expect(
      deployedCryptoDevsContract.connect(owner).presaleMint()
    ).to.be.revertedWith("You are not whitelisted");

    await deployedWhitelistContract.connect(owner).addAddressToWhitelist();
    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    await deployedWhitelistContract.connect(account3).addAddressToWhitelist();

    await deployedCryptoDevsContract
      .connect(owner)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 1);
    await deployedCryptoDevsContract
      .connect(account2)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);

    await expect(
      deployedCryptoDevsContract
        .connect(account3)
        .presaleMint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Exceeded maximum Crypto Devs supply");
  });

  it("4 during presale 4.4, 4.5, 4.6", async function () {
    await deployedCryptoDevsContract.connect(owner).startPresale();

    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    const senderBalance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(senderBalance, 0);

    // Sending too much ether
    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .presaleMint({ value: ethers.utils.parseEther("0.015") })
    ).to.be.revertedWith("Ether sent is not correct");

    // Sending too little ether
    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .presaleMint({ value: ethers.utils.parseEther("0.005") })
    ).to.be.revertedWith("Ether sent is not correct");

    await deployedCryptoDevsContract
      .connect(account2)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 1);
    const newSenderBalance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(newSenderBalance, 1);
  });

  it("4 during presale 4.7", async function () {
    await deployedCryptoDevsContract.connect(owner).startPresale();
    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    await deployedWhitelistContract.connect(account3).addAddressToWhitelist();
    // Increase time to right before presale ends to assert that the presale is still active
    // 300 seconds is 5 minutes, so I use 295.
    // - Note that I am not sure this is will work exactly like this on reality as the time seems
    //   related to block time, and a new block is created only a few times a minute.
    await helpers.time.increase(295);
    await deployedCryptoDevsContract
      .connect(account2)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });

    await helpers.time.increase(5);
    await expect(
      deployedCryptoDevsContract
        .connect(account3)
        .presaleMint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Presale is not running");
  });

  it("4 during presale 4.8, 4.9 and 4.10", async function () {
    await deployedWhitelistContract.connect(account2).addAddressToWhitelist();
    await deployedWhitelistContract.connect(account3).addAddressToWhitelist();

    assert.isFalse(await deployedCryptoDevsContract._paused());
    await deployedCryptoDevsContract.connect(owner).startPresale();
    assert.isFalse(await deployedCryptoDevsContract._paused());
    await deployedCryptoDevsContract
      .connect(account2)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });

    await expect(
      deployedCryptoDevsContract.connect(account2).setPaused(true)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    assert.isFalse(await deployedCryptoDevsContract._paused());

    await deployedCryptoDevsContract.connect(owner).setPaused(true);
    assert.isTrue(await deployedCryptoDevsContract._paused());
    await expect(
      deployedCryptoDevsContract
        .connect(account3)
        .presaleMint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Contract currently paused");

    await deployedCryptoDevsContract.connect(owner).setPaused(false);
    assert.isFalse(await deployedCryptoDevsContract._paused());

    await deployedCryptoDevsContract
      .connect(account2)
      .presaleMint({ value: ethers.utils.parseEther("0.01") });

    const account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);
    assert.equal(account2Balance, 2);
  });

  it("5 after presale, 5.1, 5.2, 5.3, 5.4 and 5.5", async function () {
    await deployedCryptoDevsContract.connect(owner).startPresale();
    // Fast forward time to the point where presale is over
    await helpers.time.increase(300);

    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .presaleMint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Presale is not running");
    let account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 0);
    assert.equal(account2Balance, 0);

    // Sending too much ether
    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .mint({ value: ethers.utils.parseEther("0.015") })
    ).to.be.revertedWith("Ether sent is not correct");

    // Sending too little ether
    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .mint({ value: ethers.utils.parseEther("0.005") })
    ).to.be.revertedWith("Ether sent is not correct");
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 0);
    account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(account2Balance, 0);

    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 1);
    account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(account2Balance, 1);

    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);
    account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(account2Balance, 2);

    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .mint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Exceeded maximum Crypto Devs supply");
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);
    account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(account2Balance, 2);
  });

  it("5 after presale, 5.6, 5.7 and 5.8", async function () {
    await deployedCryptoDevsContract.connect(owner).startPresale();
    // Fast forward time to the point where presale is over
    await helpers.time.increase(300);
    assert.isFalse(await deployedCryptoDevsContract._paused());

    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });

    await expect(
      deployedCryptoDevsContract.connect(account2).setPaused(true)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    assert.isFalse(await deployedCryptoDevsContract._paused());

    await deployedCryptoDevsContract.connect(owner).setPaused(true);
    assert.isTrue(await deployedCryptoDevsContract._paused());

    await expect(
      deployedCryptoDevsContract
        .connect(account2)
        .mint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Contract currently paused");

    await deployedCryptoDevsContract.connect(owner).setPaused(false);
    assert.isFalse(await deployedCryptoDevsContract._paused());

    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });

    const account2Balance = await deployedCryptoDevsContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(await deployedCryptoDevsContract.mintedTokenCount(), 2);
    assert.equal(account2Balance, 2);
  });

  it("6 withdraw", async function () {
    await deployedCryptoDevsContract.connect(owner).startPresale();
    // Fast forward time to the point where presale is over
    await helpers.time.increase(300);

    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });
    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });

    let ownerBalance = await deployedCryptoDevsContract
      .connect(account3)
      .balanceOf(owner.address);
    assert.equal(ownerBalance, 0);
    await expect(
      deployedCryptoDevsContract.connect(account3).withdraw()
    ).to.be.revertedWith("Ownable: caller is not the owner");

    ownerBalance = await deployedCryptoDevsContract
      .connect(account3)
      .balanceOf(account2.address);
    assert.equal(ownerBalance, 2);
  });
});
