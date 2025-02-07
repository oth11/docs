require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // ✅ Ensure `fetch` is imported correctly

const CONTRACT_ABI = require("../artifacts/contracts/SimpleNFT1155.sol/SimpleNFT1155.json").abi;
const CONTRACT_BYTECODE = require("../artifacts/contracts/SimpleNFT1155.sol/SimpleNFT1155.json").bytecode;

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;
const PINATA_JWT = process.env.PINATA_JWT; // ✅ Ensure Pinata JWT is present

if (!PRIVATE_KEY || !ALCHEMY_URL || !PINATA_JWT) {
    console.error("🚨 Missing environment variables. Check your .env file.");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function deployContract() {
    try {
        console.log("🚀 Deploying contract...");

        const factory = new ethers.ContractFactory(CONTRACT_ABI, CONTRACT_BYTECODE, wallet);
        const baseURI = "ipfs://your-metadata-folder/"; // ✅ Use IPFS base URI
        const contract = await factory.deploy(baseURI);

        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        console.log(`✅ Smart contract deployed at: ${contractAddress}`);
        return contractAddress;
    } catch (error) {
        console.error("❌ Error deploying contract:", error);
        process.exit(1);
    }
}

// ✅ Upload Empty Folder to Pinata Web3 API
async function uploadFolderToPinata(contractAddress) {
    try {
        const folderMetadata = {
            name: contractAddress,
            isDirectory: true,
            files: []
        };

        console.log("⏳ Uploading empty folder to Pinata Web3 API...");
        const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${PINATA_JWT}`
            },
            body: JSON.stringify(folderMetadata)
        });

        if (!response.ok) {
            throw new Error(`Pinata API Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ Folder uploaded to IPFS: ${data.IpfsHash}`);
        return data.IpfsHash;
    } catch (error) {
        console.error("❌ Error uploading folder to Pinata Web3:", error);
        process.exit(1);
    }
}

// ✅ Store IPFS Hash in Deployed Contract
async function storeIPFSHashInContract(contractAddress, ipfsHash) {
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    try {
        console.log("⏳ Storing IPFS hash on-chain...");
        const tx = await contract.storeIPFSHash(ipfsHash);
        await tx.wait();
        console.log(`✅ Stored IPFS Hash in contract: ${ipfsHash}`);
    } catch (error) {
        console.error("❌ Error storing IPFS hash:", error);
        process.exit(1);
    }
}

(async () => {
    const contractAddress = await deployContract();
    const ipfsHash = await uploadFolderToPinata(contractAddress);
    await storeIPFSHashInContract(contractAddress, ipfsHash);
    console.log(`✅ Pinata IPFS Hash: ${ipfsHash}`);
})();