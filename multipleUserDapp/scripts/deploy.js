// scripts/deploy.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting deployment...");
    // Get the contract factory
    const Contract = await hre.ethers.getContractFactory("MyContract");
    // Deploy the contract
    console.log("📦 Deploying contract...");
    const contract = await Contract.deploy();
    // Wait for deployment to complete
    await contract.waitForDeployment();
    // Get the deployed contract address
    const address = await contract.getAddress();
    console.log(`✅ Contract deployed at: ${address}`);
    // Get deployment transaction details
    const deploymentTx = contract.deploymentTransaction();
    console.log(`📋 Deployment transaction hash: ${deploymentTx.hash}`);
    console.log(`⛽ Gas used: ${deploymentTx.gasLimit?.toString() || 'N/A'}`);
    console.log(`🌐 Network: ${hre.network.name}`);
    // Create frontend directory if it doesn't exist
    const frontendDir = "./frontend";
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
        console.log("📁 Created frontend directory");
    }
    // Save contract address and deployment info to file for frontend use
    const contractInfo = {
        contractAddress: address,
        network: hre.network.name,
        deploymentHash: deploymentTx.hash,
        deployedAt: new Date().toISOString(),
        gasLimit: deploymentTx.gasLimit?.toString() || 'N/A'
    };
    const contractInfoPath = path.join(frontendDir, "contract-address.json");
    fs.writeFileSync(
        contractInfoPath,
        JSON.stringify(contractInfo, null, 2)
    );
    console.log(`💾 Contract info saved to: ${contractInfoPath}`);
    // Optional: Update interact.js with the new contract address
    const interactJsPath = "./interact.js";
    if (fs.existsSync(interactJsPath)) {
        try {
            let interactContent = fs.readFileSync(interactJsPath, 'utf8');
            // Replace the contract address in interact.js
            const addressRegex = /const contractAddress = "[^"]*";/;
            const newAddressLine = `const contractAddress = "${address}";`;
            if (addressRegex.test(interactContent)) {
                interactContent = interactContent.replace(addressRegex, newAddressLine);
                fs.writeFileSync(interactJsPath, interactContent);
                console.log(`🔄 Updated contract address in interact.js`);
            }
        } catch (error) {
            console.warn(`⚠️  Could not update interact.js: ${error.message}`);
        }
    }

    console.log("🎉 Deployment completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("1. Start your local Hardhat node: npx hardhat node");
    console.log("2. Open your frontend application");
    console.log("3. Test the custom hash functionality");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});
