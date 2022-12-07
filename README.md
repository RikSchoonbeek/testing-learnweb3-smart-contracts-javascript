# In this repository I am testing some Solidity smart contracts using Hardhat
The contracts are not created by myself, but the testing of them is my own work.
- the contracts are from the learnweb3.io Sophomore course

Testing is a very useful tool for asserting that the written code does what it needs to do, and that it doesn't have any unintended effects/possibilities.

This is also an attempt of me to better understand the different token standards (e.g. ERC20, ERC721), and also the different extensions that OpenZeppeling offers (e.g. ERC721Enumerable, Ownable).

I might write my own smart contracts in the coming weeks, with tests.

## Notes
- Through testing I didn't find that the CryptoDevToken contract's claim function didn't enforce the limit for tokens to be minted, and added this myself.