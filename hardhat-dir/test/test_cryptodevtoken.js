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

describe("Tests for CryptoDevToken contract", function () {
  let owner;
  let account2;
  let account3;
  let account4;

  // Used for Whitelist contract
  const maxWhitelistedAddresses = 3;

  // Used for CryptoDevs contract
  const baseURI = "https://www.example.com/";
  const maxCryptoDevsNFTCount = 4;

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

  it("2 claiming tokens using CryptoDevs NFTs, 2.1, 2.2, 2.3 and 2.4", async function () {
    // account2 gets 2 CryptoDevs NFTs
    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });
    await deployedCryptoDevsContract
      .connect(account2)
      .mint({ value: ethers.utils.parseEther("0.01") });

    // account2 claims tokens using NFTs
    let account2Balance = await deployedCryptoDevTokenContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(account2Balance, 0);
    await deployedCryptoDevTokenContract.connect(account2).claim();
    account2Balance = await deployedCryptoDevTokenContract
      .connect(account2)
      .balanceOf(account2.address);
    assert.equal(ethers.utils.formatEther(account2Balance), "20.0");

    // account3 without CryptoDevs NFTs claim gets rejected
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

    // Account with previously claimed CryptoDevs NFTs new claim gets rejected
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

    // Claim gets rejected because the amount of tokens received would cause the
    // total supply to go over limit
    // account2 gets 2 CryptoDevs NFTs (20 tokens)
    await deployedCryptoDevsContract
      .connect(account3)
      .mint({ value: ethers.utils.parseEther("0.01") });
    await deployedCryptoDevsContract
      .connect(account3)
      .mint({ value: ethers.utils.parseEther("0.01") });
    // Mint so many tokens that there are just 10 left, using normal mint
    // Mint 9970 tokens, leaving 10 tokens available before the 10000 limit is reached
    await deployedCryptoDevTokenContract
      .connect(account2)
      .mint(9970, { value: ethers.utils.parseEther("9.97") });
    // Try to claim using the NFTs -> expect to fail
    await expect(
      deployedCryptoDevTokenContract.connect(account3).claim()
    ).to.be.revertedWith("Exceeds the max total supply available.");
  });

  it("3 minting tokens, 3.1, 3.2 and 3.3", async function () {
    // Sending too much ether
    await expect(
      deployedCryptoDevTokenContract
        .connect(account2)
        .mint(10, { value: ethers.utils.parseEther("0.011") })
    ).to.be.revertedWith("Ether sent is incorrect");

    // Sending too little ether
    await expect(
      deployedCryptoDevTokenContract
        .connect(account2)
        .mint(10, { value: ethers.utils.parseEther("0.009") })
    ).to.be.revertedWith("Ether sent is incorrect");

    // Minting more tokens than are available
    await expect(
      deployedCryptoDevTokenContract
        .connect(account2)
        .mint(10001, { value: ethers.utils.parseEther("10.001") })
    ).to.be.revertedWith("Exceeds the max total supply available.");

    // Successful mint
    const totalSupplyBefore =
      await deployedCryptoDevTokenContract.totalSupply();
    assert.equal(totalSupplyBefore, 0);
    const account2BalaneBefore = await deployedCryptoDevTokenContract.balanceOf(
      account2.address
    );
    assert.equal(account2BalaneBefore, 0);

    await deployedCryptoDevTokenContract
      .connect(account2)
      .mint(10000, { value: ethers.utils.parseEther("10.000") });

    const totalSupplyAfter = await deployedCryptoDevTokenContract.totalSupply();
    assert.equal(ethers.utils.formatEther(totalSupplyAfter), "10000.0");
    const account2BalaneAfter = await deployedCryptoDevTokenContract.balanceOf(
      account2.address
    );
    assert.equal(ethers.utils.formatEther(account2BalaneAfter), "10000.0");
  });

  it("4 withdraw, 4.1 and 4.2", async function () {
    // Have some eth in the contract to withdraw
    await deployedCryptoDevTokenContract
      .connect(account2)
      .mint(5000, { value: ethers.utils.parseEther("5") });

    // Assert that withdrawing as someone that's not the owner fails
    const account3BalanceBefore = await account3.getBalance();
    let account3WithdrawTransaction;
    await expect(
      deployedCryptoDevTokenContract.connect(account3).withdraw()
    ).to.be.revertedWith("Ownable: caller is not the owner");
    const account3WithdrawTxReceipt = await account3WithdrawTransaction.wait();
    const ccount3WithdrawTxCosts = account3WithdrawTxReceipt.gasUsed.mul(
      account3WithdrawTxReceipt.effectiveGasPrice
    );
    const account3BalanceAfter = await account3.getBalance();
    console.log(
      "account3BalanceAfter.sub(account3BalanceBefore).add(ccount3WithdrawTxCosts)",
      account3BalanceAfter
        .sub(account3BalanceBefore)
        .add(ccount3WithdrawTxCosts)
    );
    console.log('ethers.utils.parseEther("0")', ethers.utils.parseEther("0"));
    assert.equal(
      account3BalanceAfter
        .sub(account3BalanceBefore)
        .add(ccount3WithdrawTxCosts),
      ethers.utils.parseEther("0")
    );

    // Assert that withdrawing as the owner succeeds
    const ownerBalanceBefore = await owner.getBalance();
    const withdrawTransaction = await deployedCryptoDevTokenContract
      .connect(owner)
      .withdraw();
    const withdrawTxReceipt = await withdrawTransaction.wait();
    const withdrawTransactionCosts = withdrawTxReceipt.gasUsed.mul(
      withdrawTxReceipt.effectiveGasPrice
    );
    const ownerBalanceAfter = await owner.getBalance();
    const balanceDelta = ownerBalanceAfter.sub(ownerBalanceBefore);

    const expectedBalanceDelta = ethers.utils
      .parseEther("5")
      .sub(withdrawTransactionCosts);
    assert.equal(
      ethers.utils.formatEther(expectedBalanceDelta),
      ethers.utils.formatEther(balanceDelta)
    );
  });

  /* TODO
  4 withdraw
    4.1 only owner of contract can call withdraw
    4.2 after successful withdraw call ether from contract is transferred to owner address
  */
});
