/* Contract CryptoDevToken
1 deployment
  1.1 CryptoDevs contract address is stored on contract correctly (this is tested indirectly with 
      test during the claiming and minting tests, where this contract is called)
  1.2 ERC20 constructor: name and symbol correctly set
2 claiming tokens using CryptoDevs NFTs
  2.1 a CryptoDevs NFT holder receives CryptoDevToken.tokensPerNFT amount of tokens per unclaimed
      NFT they own, after a successful call to the claim function
  2.2 if the caller of the claim function doesn't have any CryptoDevs NFTs:
    2.2.1 their call will be rejected
    2.2.2 they will receive no tokens from this transaction
  2.3 if the caller of the claim function does have NFTs, but no unclaimed NFTs:
    2.3.1 their call will be rejected
    2.3.2 they will receive no tokens from this transaction
  2.4 if the amount of NFTs held by the transaction sender equates more tokens than
      are available the transaction fails
3 minting tokens
  3.1 if the amount of ether sent is not equal to the amount required the transaction fails
  3.2 if token mint amount + current total supply > max total supply, than the transaction fails
  3.3 a successful claim call increases the transaction sender's balance with the amount being minted
4 withdraw
  4.1 only owner of contract can call withdraw
  4.2 after successful withdraw call ether from contract is transferred to owner address
- notes: the CryptoDevToken contract inherits from OpenZeppeling ERC20 and Ownable
         ideally it would also be tested that these are implemented, somehow. But I guess
         a standard set of tests can be written for this and maybe already exist.
*/

const { assert, expect } = require("chai");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

describe("Tests for CryptoDevToken", function () {
  let owner;
  let account2;
  let account3;
  let account4;

  // Used for Whitelist contract
  const maxWhitelistedAddresses = 3;

  // Used for CryptoDevs contract
  const baseURI = "https://www.example.com/";
  const maxCryptoDevsNFTCount = 2;

  let deployedWhitelistContract;
  let deployedCryptoDevsContract;
  let deployedCryptoDevTokenContract;

  beforeEach(async function () {
    // - Deploys whitelist contract
    // - Deploy CryptoDevs NFT contract
    const signers = await ethers.getSigners();
    owner = signers[0];
    account2 = signers[1];
    account3 = signers[2];
    account4 = signers[3];

    const whitelistContract = await hre.ethers.getContractFactory("Whitelist");
    deployedWhitelistContract = await whitelistContract
      .connect(owner)
      .deploy(maxWhitelistedAddresses);

    const cryptoDevsContract = await hre.ethers.getContractFactory(
      "CryptoDevs"
    );
    deployedCryptoDevsContract = await cryptoDevsContract
      .connect(owner)
      .deploy(
        baseURI,
        maxCryptoDevsNFTCount,
        deployedWhitelistContract.address
      );

    // Fast forward time to the point where the CryptoDevs contract presale is over,
    // as it's not a part of this test
    await deployedCryptoDevsContract.connect(owner).startPresale();
    await helpers.time.increase(300);

    const cryptoDevTokenContract = await hre.ethers.getContractFactory(
      "CryptoDevToken"
    );
    deployedCryptoDevTokenContract = await cryptoDevTokenContract
      .connect(owner)
      .deploy(deployedCryptoDevsContract.address);
  });

  it("1 deployment, 1.1", async function () {
    assert.equal(
      await deployedCryptoDevTokenContract.name(),
      "Crypto Dev Token"
    );
    assert.equal(await deployedCryptoDevTokenContract.symbol(), "CDT");

    const contractOwner = await deployedCryptoDevTokenContract.owner();
    assert.equal(contractOwner, owner.address);
  });

  it("2 claiming tokens using CryptoDevs NFTs, 2.1, 2.2", async function () {
    // await deployedWhitelistContract.connect(account2).addAddressToWhitelist();

    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });
    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });

    let account2Balance = await deployedCryptoDevTokenContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(account2Balance, 0);
    await deployedCryptoDevTokenContract.connect(account2).claim();
    account2Balance = await deployedCryptoDevTokenContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(ethers.utils.formatEther(account2Balance), "20.0");

    // Account without CryptoDevs NFTs
    let account3Balance = await deployedCryptoDevTokenContract
      .connect(account3)
      .balanceOf(account3.address);
    assert.equal(account3Balance, 0);
    await expect(
      deployedCryptoDevTokenContract.connect(account3).claim()
    ).to.be.revertedWith("You dont own any Crypto Dev NFT's");
    account3Balance = await deployedCryptoDevTokenContract
      .connect(account3)
      .balanceOf(account3.address);
    assert.equal(account3Balance, 0);

    // Account with CryptoDevs NFTs, but they are already claimed

    account2Balance = await deployedCryptoDevTokenContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(ethers.utils.formatEther(account2Balance), "20.0");
    await expect(
      deployedCryptoDevTokenContract.connect(account2).claim()
    ).to.be.revertedWith("You have already claimed all the tokens");
    account2Balance = await deployedCryptoDevTokenContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(ethers.utils.formatEther(account2Balance), "20.0");
  });

  /*
  2 claiming tokens using CryptoDevs NFTs
  V 2.1 a CryptoDevs NFT holder receives CryptoDevToken.tokensPerNFT amount of tokens per unclaimed
        NFT they own, after a successful call to the claim function
    2.2 if the caller of the claim function doesn't have any CryptoDevs NFTs:
      2.2.1 their call will be rejected
      2.2.2 they will receive no tokens from this transaction
    2.3 if the caller of the claim function does have NFTs, but no unclaimed NFTs:
      2.3.1 their call will be rejected
      2.3.2 they will receive no tokens from this transaction
    2.4 if the amount of NFTs held by the transaction sender equates more tokens than
        are available the transaction fails
  3 minting tokens
    3.1 if the amount of ether sent is not equal to the amount required the transaction fails
    3.2 if token mint amount + current total supply > max total supply, than the transaction fails
    3.3 a successful claim call increases the transaction sender's balance with the amount being minted
  4 withdraw
    4.1 only owner of contract can call withdraw
    4.2 after successful withdraw call ether from contract is transferred to owner address
  */
});
