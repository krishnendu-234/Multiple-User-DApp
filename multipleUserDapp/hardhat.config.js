require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    apothem: {
      url: "https://erpc.apothem.network", // ✅ Apothem RPC
      accounts: [process.env.PRIVATE_KEY]  // ✅ Use your .env key
    }
  }
};

