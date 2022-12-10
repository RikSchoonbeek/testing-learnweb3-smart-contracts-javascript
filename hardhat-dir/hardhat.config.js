require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env" });

const { QUICKNODE_HTTP_URL, MM_T_1_PRIVK } = process.env;

module.exports = {
  solidity: "0.8.17",
  mocha: {
    timeout: 100000000,
  },
  // networks: {
  //   goerli: {
  //     url: QUICKNODE_HTTP_URL,
  //     accounts: [MM_T_1_PRIVK],
  //   },
  // },
};
