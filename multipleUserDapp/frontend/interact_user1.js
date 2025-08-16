// Universal Hash Verification System - JavaScript Implementation
// interact_user1.js - Complete Enhanced Version with Sender Info Fixes

// ========================================
// CONTRACT CONFIGURATION
// ========================================

const contractABI = [
    {
        "inputs": [],
        "name": "getMessage",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "newMessage",
                "type": "string"
            }
        ],
        "name": "setMessage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "string",
                "name": "oldMessage",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "newMessage",
                "type": "string"
            }
        ],
        "name": "MessageUpdated",
        "type": "event"
    }
];

const contractAddress = "0x3E7C75193b4AbBd401aAbb6d8c4e7dD2F6CEE1A3";

// XDC Apothem Testnet Configuration
const XDC_NETWORK = {
    chainId: '0x33', // 51 in decimal
    chainName: 'XDC Apothem Testnet',
    rpcUrls: ['https://erpc.apothem.network'],
    nativeCurrency: {
        name: 'TXDC',
        symbol: 'TXDC',
        decimals: 18
    },
    blockExplorerUrls: ['https://apothem.blocksscan.io']
};

// ========================================
// GLOBAL VARIABLES
// ========================================

let contract = null;
let provider = null;
let signer = null;
let currentAccount = null;
let transactionHistory = [];
let connectedUsers = new Set();
let hashHistory = [];
let balanceUpdateInterval = null;
let eventListener = null;
let currentStoredMessage = "";
let currentStoredHash = "";
let advancedMode = false;

// ========================================
// CUSTOM HASH IMPLEMENTATION
// ========================================

function leftRotate(n, b) {
    return ((n << b) | (n >>> (32 - b))) >>> 0;
}

function hashFF(a, b, c, d, x, s, ac) {
    a = (a ^ ((b & c) | ((~b) & d)) ^ x ^ ac) >>> 0;
    return (leftRotate(a, s) ^ b) >>> 0;
}

function hashGG(a, b, c, d, x, s, ac) {
    a = (a ^ ((b & d) | (c & (~d))) ^ x ^ ac) >>> 0;
    return (leftRotate(a, s) ^ b) >>> 0;
}

function hashHH(a, b, c, d, x, s, ac) {
    a = (a ^ (b ^ c ^ d) ^ x ^ ac) >>> 0;
    return (leftRotate(a, s) ^ b) >>> 0;
}

function hashII(a, b, c, d, x, s, ac) {
    a = (a ^ (c ^ (b | (~d))) ^ x ^ ac) >>> 0;
    return (leftRotate(a, s) ^ b) >>> 0;
}

function circularShift(text, shift) {
    const len = text.length;
    const normalizedShift = ((shift % len) + len) % len;
    return text.slice(normalizedShift) + text.slice(0, normalizedShift);
}

function mix(msg, secret) {
    const length = secret.length;
    const midpoint = Math.floor(length / 2);
    const firstPart = circularShift(secret.slice(0, midpoint), 2);
    const secondPart = circularShift(secret.slice(midpoint), -3);
    return firstPart + msg + secondPart;
}

function customHash(msg, secret = "USER1_SECRET_KEY_ABC123==") {
    const message = mix(msg, secret);

    const encoder = new TextEncoder();
    let messageBytes = new Uint8Array(encoder.encode(message));
    const origLenInBits = messageBytes.length * 8;

    const tempArray = new Uint8Array(messageBytes.length + 1);
    tempArray.set(messageBytes);
    tempArray[messageBytes.length] = 0x80;
    messageBytes = tempArray;

    while (messageBytes.length % 64 !== 56) {
        const newArray = new Uint8Array(messageBytes.length + 1);
        newArray.set(messageBytes);
        newArray[messageBytes.length] = 0;
        messageBytes = newArray;
    }

    const finalArray = new Uint8Array(messageBytes.length + 8);
    finalArray.set(messageBytes);
    const dataView = new DataView(finalArray.buffer);
    dataView.setUint32(messageBytes.length, origLenInBits & 0xffffffff, true);
    dataView.setUint32(messageBytes.length + 4, (origLenInBits >>> 32) & 0xffffffff, true);
    messageBytes = finalArray;

    const initVals = [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344,
                      0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89];
    let [a, b, c, d, e, f, g, h] = initVals;

    for (let i = 0; i < messageBytes.length; i += 64) {
        const w = [];
        const view = new DataView(messageBytes.buffer, i, 64);
        for (let j = 0; j < 16; j++) {
            w[j] = view.getUint32(j * 4, true);
        }
        a = hashFF(a, b, c, d, w[0], 7, 0xd1310ba6);
        b = hashGG(b, c, d, e, w[1], 11, 0x98dfb5ac);
        c = hashHH(c, d, e, f, w[2], 13, 0x2ffd72db);
        d = hashII(d, e, f, g, w[3], 17, 0xd01adfb7);
        e = hashFF(e, f, g, h, w[4], 7, 0xb8e1afed);
        f = hashGG(f, g, h, a, w[5], 11, 0x6a267e96);
        g = hashHH(g, h, a, b, w[6], 13, 0xba7c9045);
        h = hashII(h, a, b, c, w[7], 17, 0xf12c7f99);

        a = (a + initVals[0]) >>> 0;
        b = (b + initVals[1]) >>> 0;
        c = (c + initVals[2]) >>> 0;
        d = (d + initVals[3]) >>> 0;
        e = (e + initVals[4]) >>> 0;
        f = (f + initVals[5]) >>> 0;
        g = (g + initVals[6]) >>> 0;
        h = (h + initVals[7]) >>> 0;
    }

    const result = new ArrayBuffer(32);
    const view = new DataView(result);
    view.setUint32(0, a, true);
    view.setUint32(4, b, true);
    view.setUint32(8, c, true);
    view.setUint32(12, d, true);
    view.setUint32(16, e, true);
    view.setUint32(20, f, true);
    view.setUint32(24, g, true);
    view.setUint32(28, h, true);

    const digest = Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash: digest, size: 32 };
}

function hashMessage(message, secret = "USER1_SECRET_KEY_ABC123==") {
    print("--- Hash Function Execution ---");
    print("Input message: " + message);
    print("Secret key: " + secret);

    const startTime = performance.now();
    const result = customHash(message, secret);
    const endTime = performance.now();

    const inputSize = new TextEncoder().encode(mix(message, secret)).length;

    print("Hash Output: " + result.hash);
    print("Input Size: " + inputSize + " bytes");
    print("Output Size: " + result.size + " bytes (" + (result.size * 8) + " bits)");
    print("Time taken: " + (endTime - startTime).toFixed(3) + " ms");
    print("--- End Hash Execution ---\n");

    // Store in history
    hashHistory.push({
        timestamp: new Date(),
        message: message,
        secret: secret,
        hash: result.hash,
        inputSize: inputSize,
        outputSize: result.size,
        executionTime: (endTime - startTime).toFixed(3)
    });

    return result.hash;
}

// ========================================
// WALLET CONNECTION FUNCTIONS
// ========================================

async function connectWallet() {
    try {
        print("Checking for MetaMask...");
        
        // Check if MetaMask is installed
        if (typeof window.ethereum === 'undefined') {
            print("ERROR: MetaMask not detected! Please install MetaMask extension.");
            alert("MetaMask not detected! Please install MetaMask extension first.");
            return;
        }

        // Check if ethers.js is loaded
        if (typeof ethers === 'undefined') {
            print("ERROR: Ethers.js not loaded! Please refresh the page.");
            alert("Ethers.js library not loaded! Please refresh the page.");
            return;
        }

        print("Requesting account access...");
        
        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts.length === 0) {
            print("ERROR: No accounts found. Please unlock MetaMask.");
            return;
        }

        currentAccount = accounts[0];
        print("Connected account: " + currentAccount);
        
        // Setup provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        
        // Initialize contract
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        
        print("Contract initialized at: " + contractAddress);
        
        // Try to switch to XDC network
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: XDC_NETWORK.chainId }],
            });
            print("Switched to XDC Apothem Testnet");
        } catch (switchError) {
            // Network doesn't exist, add it
            if (switchError.code === 4902) {
                print("Adding XDC Apothem Testnet to MetaMask...");
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [XDC_NETWORK],
                });
                print("XDC Apothem Testnet added successfully");
            } else {
                print("ERROR switching network: " + switchError.message);
            }
        }
        
        print("Wallet connected successfully!\n");
        
        updateUI();
        await updateBalance();
        startBalanceMonitoring();
        setupEnhancedEventListeners();
        addToConnectedUsers(currentAccount);
        
    } catch (error) {
        print("ERROR connecting wallet: " + error.message);
        console.error("Connection error:", error);
    }
}

function disconnectWallet() {
    currentAccount = null;
    contract = null;
    provider = null;
    signer = null;
    
    if (balanceUpdateInterval) {
        clearInterval(balanceUpdateInterval);
        balanceUpdateInterval = null;
    }
    
    if (eventListener && contract) {
        contract.removeAllListeners("MessageUpdated");
        eventListener = null;
    }
    
    print("Wallet disconnected");
    updateUI();
}

async function recoverConnection() {
    print("Attempting to recover connection...");
    
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            } else {
                print("No accounts found. Please connect manually.");
            }
        } catch (error) {
            print("Recovery failed: " + error.message);
        }
    } else {
        print("MetaMask not available for recovery");
    }
}

// ========================================
// BLOCKCHAIN INTERACTION FUNCTIONS
// ========================================

async function sendHashedMessage() {
    try {
        if (!contract) {
            print("ERROR: Wallet not connected!");
            return;
        }
        
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) {
            print("ERROR: Message input field not found!");
            return;
        }
        
        const newMessage = messageInput.value.trim();
        if (!newMessage) {
            print("ERROR: Please enter a message!");
            return;
        }
        
        print("Setting new message on blockchain...");
        print("Message: " + newMessage);
        print("From Address: " + currentAccount);
        
        // Generate hash before sending
        const messageHash = hashMessage(newMessage);
        
        // Estimate gas to avoid failures
        try {
            const gasEstimate = await contract.estimateGas.setMessage(newMessage);
            print("Estimated gas: " + gasEstimate.toString());
        } catch (gasError) {
            print("Warning: Could not estimate gas: " + gasError.message);
        }
        
        // Send transaction with higher gas limit
        const tx = await contract.setMessage(newMessage, {
            gasLimit: 300000 // Set a reasonable gas limit
        });
        
        print("Transaction sent: " + tx.hash);
        print("Waiting for confirmation...");
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        print("Transaction confirmed in block: " + receipt.blockNumber);
        print("Gas used: " + receipt.gasUsed.toString());
        
        // Process events from the receipt
        if (receipt.events && receipt.events.length > 0) {
            print("Events emitted:");
            receipt.events.forEach((event, index) => {
                if (event.event === 'MessageUpdated') {
                    print(`- MessageUpdated event found`);
                    print(`- Old Message: "${event.args.oldMessage}"`);
                    print(`- New Message: "${event.args.newMessage}"`);
                }
            });
        }
        
        // Add to transaction history
        transactionHistory.push({
            type: 'SET_MESSAGE',
            message: newMessage,
            hash: messageHash,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            timestamp: new Date(),
            from: currentAccount
        });
        
        // Update current stored message and hash
        currentStoredMessage = newMessage;
        currentStoredHash = messageHash;
        
        // Clear input
        messageInput.value = '';
        
        print("Message successfully stored on blockchain!\n");
        
        // Update displays
        updateTransactionHistory();
        updateMessageDisplay(newMessage, currentAccount, messageHash, tx.hash, receipt.blockNumber);
        
        return receipt;
        
    } catch (error) {
        print("ERROR setting message: " + error.message);
        console.error("Full error:", error);
        return null;
    }
}

// ENHANCED getMessage() FUNCTION with improved sender detection
async function getMessage() {
    try {
        if (!contract) {
            print("ERROR: Wallet not connected!");
            return;
        }
        
        print("Fetching stored message from blockchain...");
        
        // Get the message from contract
        const message = await contract.getMessage();
        currentStoredMessage = message;
        
        let senderAddress = "Unknown";
        let transactionHash = "Unknown";
        let blockNumber = "Unknown";
        
        try {
            print("Searching for MessageUpdated events...");
            
            // Create filter for MessageUpdated events
            const filter = contract.filters.MessageUpdated();
            
            // Query events from a larger range of blocks
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 5000); // Increased range
            
            print(`Searching from block ${fromBlock} to ${currentBlock}...`);
            
            const events = await contract.queryFilter(filter, fromBlock, currentBlock);
            print(`Found ${events.length} MessageUpdated events`);
            
            if (events.length > 0) {
                // Get the most recent event that matches our current message
                let matchingEvent = null;
                
                // Search for event with matching newMessage (exact match first)
                for (let i = events.length - 1; i >= 0; i--) {
                    const event = events[i];
                    if (event.args && event.args.newMessage === message) {
                        matchingEvent = event;
                        print(`Found exact message match in event ${i + 1}`);
                        break;
                    }
                }
                
                // If no exact match, use the most recent event
                if (!matchingEvent && events.length > 0) {
                    matchingEvent = events[events.length - 1];
                    print("No exact message match found, using most recent event");
                }
                
                if (matchingEvent) {
                    // Get transaction details
                    const transaction = await provider.getTransaction(matchingEvent.transactionHash);
                    senderAddress = transaction.from;
                    transactionHash = matchingEvent.transactionHash;
                    blockNumber = matchingEvent.blockNumber;
                    
                    print("Event found successfully:");
                    print(`- Sender: ${senderAddress}`);
                    print(`- Transaction: ${transactionHash}`);
                    print(`- Block: ${blockNumber}`);
                } else {
                    print("No matching events found");
                }
            } else {
                print("No MessageUpdated events found in recent blocks");
                
                // Try alternative method: check transaction history
                print("Trying transaction history...");
                const localHistory = transactionHistory.filter(tx => 
                    tx.message === message && tx.type === 'SET_MESSAGE'
                );
                
                if (localHistory.length > 0) {
                    const latestTx = localHistory[localHistory.length - 1];
                    senderAddress = latestTx.from;
                    transactionHash = latestTx.txHash;
                    blockNumber = latestTx.blockNumber;
                    print(`Found sender in local history: ${senderAddress}`);
                }
            }
            
        } catch (eventError) {
            print(`Warning: Could not retrieve event data: ${eventError.message}`);
            print("This might happen if the message was set before connecting to this session");
        }
        
        print("--- Message Retrieved ---");
        print("Message: " + message);
        print("Sender Address: " + senderAddress);
        print("Transaction Hash: " + transactionHash);
        print("Block Number: " + blockNumber);
        
        // Generate hash of the retrieved message
        currentStoredHash = hashMessage(message);
        print("Message Hash: " + currentStoredHash);
        print("--- End Retrieval ---\n");
        
        // Update UI elements with proper sender address
        updateMessageDisplay(message, senderAddress, currentStoredHash, transactionHash, blockNumber);
        
        return { 
            message, 
            senderAddress, 
            hash: currentStoredHash, 
            transactionHash, 
            blockNumber 
        };
        
    } catch (error) {
        print("ERROR retrieving message: " + error.message);
        console.error("Full error:", error);
        return null;
    }
}

// ========================================
// HASH VERIFICATION FUNCTIONS
// ========================================

async function verifyHash() {
    try {
        const verifyInput = document.getElementById('verifyInput');
        if (!verifyInput) {
            print("ERROR: Verify input field not found!");
            return;
        }
        
        const inputMessage = verifyInput.value.trim();
        if (!inputMessage) {
            print("ERROR: Please enter a message to verify!");
            return;
        }
        
        print("--- Hash Verification ---");
        print("Input message: " + inputMessage);
        
        // Generate hash for input message
        const inputHash = hashMessage(inputMessage);
        
        // Get stored message if not already retrieved
        if (!currentStoredMessage) {
            await getMessage();
        }
        
        print("Stored message: " + currentStoredMessage);
        print("Input hash: " + inputHash);
        print("Stored hash: " + currentStoredHash);
        
        // Compare hashes
        const isMatch = inputHash === currentStoredHash;
        print("Hash match: " + isMatch);
        print("--- End Verification ---\n");
        
        // Update UI with verification result
        updateVerificationResult(isMatch, inputHash, currentStoredHash);
        
        return isMatch;
        
    } catch (error) {
        print("ERROR during verification: " + error.message);
        return false;
    }
}

function generateHashOnly() {
    try {
        const hashInput = document.getElementById('hashInput');
        if (!hashInput) {
            print("ERROR: Hash input field not found!");
            return;
        }
        
        const message = hashInput.value.trim();
        if (!message) {
            print("ERROR: Please enter a message to hash!");
            return;
        }
        
        print("--- Standalone Hash Generation ---");
        const hash = hashMessage(message);
        print("Generated hash: " + hash);
        print("--- End Generation ---\n");
        
        return hash;
        
    } catch (error) {
        print("ERROR generating hash: " + error.message);
        return null;
    }
}

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

// UPDATED updateMessageDisplay function to show more details
function updateMessageDisplay(message, senderAddress, messageHash, transactionHash = "Unknown", blockNumber = "Unknown") {
    const messageDisplay = document.getElementById('messageDisplay');
    const currentMessage = document.getElementById('currentMessage');
    const contractAddressDisplay = document.getElementById('contractAddressDisplay');
    const senderAddressDisplay = document.getElementById('senderAddressDisplay');
    
    if (messageDisplay) {
        messageDisplay.style.display = 'block';
    }
    
    if (currentMessage) {
        currentMessage.textContent = message;
    }
    
    if (contractAddressDisplay) {
        contractAddressDisplay.innerHTML = contractAddress + 
            ' <button class="copy-btn" onclick="copyToClipboard(\'' + contractAddress + '\', \'Contract address\')">Copy</button>';
    }
    
    if (senderAddressDisplay) {
        // Show full address with copy button, and additional transaction details
        senderAddressDisplay.innerHTML = `
            <div>
                <strong>Address:</strong> ${senderAddress} 
                <button class="copy-btn" onclick="copyToClipboard('${senderAddress}', 'Sender address')">Copy</button>
            </div>
            ${transactionHash !== "Unknown" ? `
                <div style="margin-top: 5px; font-size: 0.9em; color: #666;">
                    <strong>Tx Hash:</strong> ${transactionHash.substring(0, 16)}...
                    <button class="copy-btn" onclick="copyToClipboard('${transactionHash}', 'Transaction hash')">Copy</button>
                </div>
            ` : ''}
            ${blockNumber !== "Unknown" ? `
                <div style="margin-top: 3px; font-size: 0.9em; color: #666;">
                    <strong>Block:</strong> ${blockNumber}
                </div>
            ` : ''}
        `;
    }
    
    // Also add sender to connected users list if it's a valid address
    if (senderAddress !== "Unknown" && senderAddress.startsWith('0x')) {
        addToConnectedUsers(senderAddress);
    }
}

function updateVerificationResult(isMatch, inputHash, storedHash) {
    const verificationResult = document.getElementById('verificationResult');
    const hashComparison = document.getElementById('hashComparison');
    const storedHashDisplay = document.getElementById('storedHashDisplay');
    const generatedHashDisplay = document.getElementById('generatedHashDisplay');
    const matchStatus = document.getElementById('matchStatus');
    
    if (verificationResult) {
        verificationResult.style.display = 'block';
        verificationResult.className = isMatch ? 'verification-result verification-success' : 'verification-result verification-failure';
        verificationResult.textContent = isMatch ? '✅ Hash Verification PASSED - Messages match!' : '❌ Hash Verification FAILED - Messages do not match!';
    }
    
    if (hashComparison) {
        hashComparison.style.display = 'block';
    }
    
    if (storedHashDisplay) {
        storedHashDisplay.textContent = storedHash;
    }
    
    if (generatedHashDisplay) {
        generatedHashDisplay.textContent = inputHash;
    }
    
    if (matchStatus) {
        matchStatus.className = 'match-status';
        matchStatus.style.background = isMatch ? '#d4edda' : '#f8d7da';
        matchStatus.style.color = isMatch ? '#155724' : '#721c24';
        matchStatus.textContent = isMatch ? '✅ MATCH' : '❌ NO MATCH';
    }
}

// UPDATED updateUI() FUNCTION - Added refreshSenderBtn and forceRefreshBtn
function updateUI() {
    // Update wallet address
    const walletAddress = document.getElementById('walletAddress');
    if (walletAddress) {
        walletAddress.textContent = currentAccount || 'Not connected';
    }
    
    // Update connection status
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        if (currentAccount) {
            connectionStatus.textContent = 'Connected';
            connectionStatus.className = 'status connected';
        } else {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.className = 'status disconnected';
        }
    }
    
    // Update network info
    const networkName = document.getElementById('networkName');
    const chainId = document.getElementById('chainId');
    if (networkName) {
        networkName.textContent = currentAccount ? XDC_NETWORK.chainName : 'Unknown';
    }
    if (chainId) {
        chainId.textContent = currentAccount ? XDC_NETWORK.chainId : 'N/A';
    }
    
    // Enable/disable buttons - UPDATED to include new buttons
    const buttons = [
        'sendMessageBtn', 'getMessageBtn', 'verifyHashBtn', 
        'generateHashBtn', 'refreshBalanceBtn', 'refreshSenderBtn', 'forceRefreshBtn'
    ];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = !currentAccount;
        }
    });
}

async function updateBalance() {
    if (currentAccount && provider) {
        try {
            const balance = await provider.getBalance(currentAccount);
            const balanceInEther = ethers.utils.formatEther(balance);
            
            const balanceDisplay = document.getElementById('walletBalance');
            if (balanceDisplay) {
                balanceDisplay.textContent = `${parseFloat(balanceInEther).toFixed(4)} TXDC`;
            }
        } catch (error) {
            print("Error updating balance: " + error.message);
        }
    }
}

async function refreshBalance() {
    print("Refreshing balance...");
    await updateBalance();
    print("Balance updated");
}

function updateTransactionHistory() {
    const historyContainer = document.getElementById('transactionHistory');
    if (!historyContainer) return;
    
    if (transactionHistory.length === 0) {
        historyContainer.innerHTML = '<div class="transaction-item">No transactions yet</div>';
        return;
    }
    
    const historyHTML = transactionHistory.map((tx, index) => `
        <div class="transaction-item">
            <strong>${tx.type}</strong><br>
            Message: ${tx.message.substring(0, 50)}${tx.message.length > 50 ? '...' : ''}<br>
            Hash: ${tx.hash.substring(0, 16)}...<br>
            Block: ${tx.blockNumber}<br>
            Time: ${tx.timestamp.toLocaleString()}
        </div>
    `).join('');
    
    historyContainer.innerHTML = historyHTML;
}

function startBalanceMonitoring() {
    if (balanceUpdateInterval) {
        clearInterval(balanceUpdateInterval);
    }
    
    updateBalance(); // Initial update
    balanceUpdateInterval = setInterval(updateBalance, 15000); // Update every 15 seconds
}

// ========================================
// ENHANCED FUNCTIONS
// ========================================

function validateHashIntegrity() {
    print("--- Hash Integrity Validation ---");
    
    if (hashHistory.length < 2) {
        print("Not enough hash history for integrity validation");
        print("--- End Validation ---\n");
        return;
    }
    
    let corruptedCount = 0;
    let validCount = 0;
    
    print("Validating hash consistency...");
    
    hashHistory.forEach((item, index) => {
        // Re-calculate hash for each stored message
        const recalculatedHash = customHash(item.message, item.secret);
        
        if (recalculatedHash.hash === item.hash) {
            validCount++;
            print(`${index + 1}. ✅ Hash integrity VALID for: "${item.message.substring(0, 30)}..."`);
        } else {
            corruptedCount++;
            print(`${index + 1}. ❌ Hash integrity CORRUPTED for: "${item.message.substring(0, 30)}..."`);
            print(`   Stored Hash: ${item.hash}`);
            print(`   Recalculated: ${recalculatedHash.hash}`);
        }
    });
    
    print(`--- Integrity Summary ---`)
    // ========================================
// MISSING FUNCTIONS - PERFECTLY MATCHED TO index1.html
// ========================================

// Continue from where the original code left off...

    print("Valid hashes: " + validCount);
    print("Corrupted hashes: " + corruptedCount);
    print("Total integrity: " + ((validCount / hashHistory.length) * 100).toFixed(2) + "%");
    print("--- End Validation ---\n");
    
    // Update UI with validation results
    showNotification(
        corruptedCount === 0 ? 'All hashes validated successfully!' : `Warning: ${corruptedCount} corrupted hashes found!`,
        corruptedCount === 0 ? 'success' : 'warning'
    );
}

function performHashBenchmark() {
    print("--- Hash Performance Benchmark ---");
    
    const testMessages = [
        "Short message",
        "This is a medium length message for testing hash performance and consistency across different input sizes.",
        "This is a very long message that we will use to test the hash function performance with larger inputs. ".repeat(10),
        "Special characters: !@#$%^&*()_+-=[]{}|;':\",./<>?`~",
        "Numbers: 1234567890".repeat(5),
        ""  // Empty string test
    ];
    
    const iterations = 100;
    let totalTime = 0;
    let results = [];
    
    testMessages.forEach((message, index) => {
        print(`Test ${index + 1}: "${message.length > 50 ? message.substring(0, 50) + '...' : message}"`);
        
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
            customHash(message);
        }
        
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;
        
        results.push({
            messageLength: message.length,
            avgTime: avgTime,
            throughput: (message.length / avgTime * 1000).toFixed(2) // bytes per second
        });
        
        print(`- Average time: ${avgTime.toFixed(3)} ms`);
        print(`- Throughput: ${(message.length / avgTime * 1000).toFixed(2)} bytes/sec`);
        
        totalTime += (endTime - startTime);
    });
    
    print(`--- Benchmark Summary ---`);
    print(`Total benchmark time: ${totalTime.toFixed(3)} ms`);
    print(`Average per hash: ${(totalTime / (testMessages.length * iterations)).toFixed(3)} ms`);
    print(`Hashes per second: ${((testMessages.length * iterations) / totalTime * 1000).toFixed(2)}`);
    print("--- End Benchmark ---\n");
    
    showNotification('Hash benchmark completed successfully!', 'success');
}

async function checkNetworkStatus() {
    print("--- Network Status Check ---");
    
    if (!provider) {
        print("ERROR: No provider available");
        return;
    }
    
    try {
        // Get network information
        const network = await provider.getNetwork();
        print("Network Name: " + network.name);
        print("Chain ID: " + network.chainId);
        
        // Get current block number
        const blockNumber = await provider.getBlockNumber();
        print("Current Block Number: " + blockNumber);
        
        // Get gas price
        const gasPrice = await provider.getGasPrice();
        print("Current Gas Price: " + ethers.utils.formatUnits(gasPrice, 'gwei') + " Gwei");
        
        // Test connection speed
        const startTime = performance.now();
        await provider.getBalance(currentAccount);
        const endTime = performance.now();
        print("Connection Speed: " + (endTime - startTime).toFixed(2) + " ms");
        
        // Check contract status
        if (contract) {
            try {
                const message = await contract.getMessage();
                print("Contract Status: Active");
                print("Contract Response Time: " + (performance.now() - endTime).toFixed(2) + " ms");
            } catch (contractError) {
                print("Contract Status: Error - " + contractError.message);
            }
        }
        
        print("--- Network Status: HEALTHY ---\n");
        showNotification('Network status check completed!', 'success');
        
    } catch (error) {
        print("ERROR checking network status: " + error.message);
        print("--- Network Status: ISSUES DETECTED ---\n");
        showNotification('Network issues detected!', 'error');
    }
}

async function performNetworkDiagnostics() {
    print("--- Network Diagnostics ---");
    
    // Check MetaMask availability
    if (typeof window.ethereum === 'undefined') {
        print("❌ MetaMask: Not installed");
        showNotification('MetaMask not detected!', 'error');
        return;
    } else {
        print("✅ MetaMask: Available");
    }
    
    // Check Ethers.js
    if (typeof ethers === 'undefined') {
        print("❌ Ethers.js: Not loaded");
        showNotification('Ethers.js not loaded!', 'error');
        return;
    } else {
        print("✅ Ethers.js: Loaded (version " + ethers.version + ")");
    }
    
    // Check connection
    if (!currentAccount) {
        print("⚠️ Wallet: Not connected");
    } else {
        print("✅ Wallet: Connected (" + currentAccount.substring(0, 10) + "...)");
    }
    
    // Check provider
    if (!provider) {
        print("❌ Provider: Not initialized");
    } else {
        print("✅ Provider: Active");
        
        try {
            const network = await provider.getNetwork();
            print("✅ Network: " + network.name + " (Chain ID: " + network.chainId + ")");
            
            if (network.chainId !== 51) {
                print("⚠️ Warning: Not on XDC Apothem Testnet");
            }
            
        } catch (networkError) {
            print("❌ Network: Error - " + networkError.message);
        }
    }
    
    // Check contract
    if (!contract) {
        print("❌ Contract: Not initialized");
    } else {
        print("✅ Contract: Initialized at " + contractAddress);
        
        try {
            // Test contract call
            const testCall = await contract.getMessage();
            print("✅ Contract Call: Successful");
        } catch (contractError) {
            print("❌ Contract Call: Failed - " + contractError.message);
        }
    }
    
    print("--- Diagnostics Complete ---\n");
    showNotification('Network diagnostics completed!', 'info');
}

async function refreshSenderInfo() {
    print("--- Refreshing Sender Information ---");
    
    if (!currentStoredMessage) {
        print("No stored message found. Fetching from blockchain...");
        await getMessage();
        return;
    }
    
    try {
        print("Searching for sender of current message...");
        
        // Enhanced event search with multiple strategies
        const filter = contract.filters.MessageUpdated();
        const currentBlock = await provider.getBlockNumber();
        
        // Strategy 1: Recent blocks (fast)
        let fromBlock = Math.max(0, currentBlock - 1000);
        print(`Strategy 1: Searching blocks ${fromBlock} to ${currentBlock}...`);
        
        let events = await contract.queryFilter(filter, fromBlock, currentBlock);
        print(`Found ${events.length} events in recent blocks`);
        
        // Strategy 2: Extended search if nothing found
        if (events.length === 0) {
            fromBlock = Math.max(0, currentBlock - 10000);
            print(`Strategy 2: Extended search from block ${fromBlock}...`);
            events = await contract.queryFilter(filter, fromBlock, currentBlock);
            print(`Found ${events.length} events in extended search`);
        }
        
        // Strategy 3: Process events to find matching message
        let senderFound = false;
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (event.args && event.args.newMessage === currentStoredMessage) {
                const transaction = await provider.getTransaction(event.transactionHash);
                
                print("✅ Sender found!");
                print("Sender Address: " + transaction.from);
                print("Transaction Hash: " + event.transactionHash);
                print("Block Number: " + event.blockNumber);
                
                // Update UI
                updateMessageDisplay(
                    currentStoredMessage, 
                    transaction.from, 
                    currentStoredHash, 
                    event.transactionHash, 
                    event.blockNumber
                );
                
                senderFound = true;
                break;
            }
        }
        
        if (!senderFound) {
            print("⚠️ No matching sender found for current message");
            print("This could mean the message was set before this session");
        }
        
    } catch (error) {
        print("ERROR refreshing sender info: " + error.message);
    }
    
    print("--- End Sender Refresh ---\n");
}

async function forceEventRefresh() {
    print("--- Force Event Refresh ---");
    
    try {
        // Clear current event listener
        if (eventListener && contract) {
            contract.removeAllListeners("MessageUpdated");
            eventListener = null;
            print("Cleared existing event listeners");
        }
        
        // Re-setup event listeners
        setupEnhancedEventListeners();
        print("Re-established event listeners");
        
        // Force refresh of current message and sender info
        await getMessage();
        
        print("Event refresh completed successfully");
        showNotification('Event listeners refreshed!', 'success');
        
    } catch (error) {
        print("ERROR during force refresh: " + error.message);
        showNotification('Error refreshing events!', 'error');
    }
    
    print("--- End Force Refresh ---\n");
}

function setupEnhancedEventListeners() {
    if (!contract) return;
    
    print("Setting up enhanced event listeners...");
    
    // Remove existing listeners first
    try {
        contract.removeAllListeners("MessageUpdated");
    } catch (e) {
        // Ignore errors when removing listeners
    }
    
    // Setup new listener with enhanced logging
    eventListener = contract.on("MessageUpdated", (oldMessage, newMessage, event) => {
        print("--- Real-time Event Detected ---");
        print("Event: MessageUpdated");
        print("Old Message: " + oldMessage);
        print("New Message: " + newMessage);
        print("Transaction Hash: " + event.transactionHash);
        print("Block Number: " + event.blockNumber);
        
        // Get transaction details
        provider.getTransaction(event.transactionHash).then(tx => {
            print("Sender Address: " + tx.from);
            print("Gas Used: " + tx.gasLimit.toString());
            
            // Add to connected users
            addToConnectedUsers(tx.from);
            
            // Update UI if this is a new message
            if (newMessage !== currentStoredMessage) {
                currentStoredMessage = newMessage;
                currentStoredHash = hashMessage(newMessage);
                
                updateMessageDisplay(newMessage, tx.from, currentStoredHash, event.transactionHash, event.blockNumber);
                
                // Add to transaction history
                transactionHistory.push({
                    type: 'RECEIVED_MESSAGE',
                    message: newMessage,
                    hash: currentStoredHash,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    gasUsed: 'N/A',
                    timestamp: new Date(),
                    from: tx.from
                });
                
                updateTransactionHistory();
                showNotification('New message received!', 'info');
            }
            
            print("--- End Real-time Event ---\n");
        }).catch(txError => {
            print("Error getting transaction details: " + txError.message);
        });
    });
    
    print("Enhanced event listeners established");
}

function addToConnectedUsers(userAddress) {
    if (userAddress && userAddress.startsWith('0x')) {
        connectedUsers.add(userAddress);
        updateConnectedUsers();
    }
}

function updateConnectedUsers() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    
    if (connectedUsers.size === 0) {
        userList.innerHTML = '<div class="user-item">No users connected</div>';
        return;
    }
    
    const usersHTML = Array.from(connectedUsers).map(address => {
        const isCurrentUser = address === currentAccount;
        return `
            <div class="user-item ${isCurrentUser ? 'current-user' : ''}">
                <div>
                    <strong>${isCurrentUser ? 'You' : 'User'}</strong><br>
                    <span style="font-family: monospace; font-size: 0.9em;">${address}</span>
                </div>
                <button class="copy-btn" onclick="copyToClipboard('${address}', 'User address')">Copy</button>
            </div>
        `;
    }).join('');
    
    userList.innerHTML = usersHTML;
}

function updateHashHistoryDisplay() {
    const historyDisplay = document.getElementById('hashHistoryDisplay');
    if (!historyDisplay) return;
    
    if (hashHistory.length === 0) {
        historyDisplay.innerHTML = '<div class="history-item">No hash history available</div>';
        return;
    }
    
    const historyHTML = hashHistory.map((item, index) => `
        <div class="history-item">
            <div class="history-header">
                <span>Hash #${index + 1}</span>
                <span>${item.timestamp.toLocaleString()}</span>
            </div>
            <div class="history-content">
                <div><strong>Message:</strong> ${item.message.length > 50 ? item.message.substring(0, 50) + '...' : item.message}</div>
                <div><strong>Hash:</strong> <span style="font-family: monospace; font-size: 0.8em;">${item.hash}</span></div>
                <div class="history-stats">
                    <span>Input: ${item.inputSize} bytes</span>
                    <span>Output: ${item.outputSize} bytes</span>
                    <span>Time: ${item.executionTime} ms</span>
                </div>
            </div>
        </div>
    `).join('');
    
    historyDisplay.innerHTML = historyHTML;
}

function exportHashHistory() {
    if (hashHistory.length === 0) {
        showNotification('No hash history to export!', 'warning');
        return;
    }
    
    const exportData = {
        exportTime: new Date().toISOString(),
        userAddress: currentAccount,
        totalHashes: hashHistory.length,
        history: hashHistory
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `hash_history_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    print("Hash history exported successfully");
    showNotification('Hash history exported!', 'success');
}

function clearHashHistory() {
    if (hashHistory.length === 0) {
        showNotification('Hash history is already empty!', 'info');
        return;
    }
    
    if (confirm(`Are you sure you want to clear ${hashHistory.length} hash entries?`)) {
        hashHistory = [];
        updateHashHistoryDisplay();
        print("Hash history cleared");
        showNotification('Hash history cleared!', 'success');
    }
}

function toggleAdvancedMode() {
    const panel = document.getElementById('advancedPanel');
    const button = document.getElementById('toggleAdvancedBtn');
    
    if (!panel || !button) return;
    
    advancedMode = !advancedMode;
    
    if (advancedMode) {
        panel.style.display = 'block';
        button.textContent = 'Hide Advanced Features';
        button.className = 'btn btn-warning';
        print("Advanced mode activated");
    } else {
        panel.style.display = 'none';
        button.textContent = 'Show Advanced Features';
        button.className = 'btn btn-info';
        print("Advanced mode deactivated");
    }
}

function copyToClipboard(text, description) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification(`${description} copied to clipboard!`, 'success');
        print(`Copied to clipboard: ${description}`);
    }).catch(err => {
        print(`Failed to copy ${description}: ${err.message}`);
        showNotification(`Failed to copy ${description}!`, 'error');
    });
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 100);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ========================================
// UTILITY FUNCTIONS MATCHING HTML IDs
// ========================================

function print(message) {
    const output = document.getElementById('output');
    if (output) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = `[${timestamp}] ${message}`;
        output.appendChild(logEntry);
        output.scrollTop = output.scrollHeight;
    }
    console.log(message);
}

function clearOutput() {
    const output = document.getElementById('output');
    if (output) {
        output.innerHTML = '';
        print("Console cleared");
    }
}

// ========================================
// INITIALIZATION & EVENT HANDLERS
// ========================================

// Auto-connect on page load if previously connected
window.addEventListener('load', async function() {
    print("Universal Hash Verification System - USER1 initialized");
    print("System ready. Please connect your wallet to begin.");
    
    // Try to auto-recover connection
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                print("Previous connection detected. Attempting to recover...");
                await recoverConnection();
            }
        } catch (error) {
            print("Auto-recovery failed: " + error.message);
        }
    }
    
    updateUI();
});

// Handle account changes
if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
            print("Account disconnected");
            disconnectWallet();
        } else if (accounts[0] !== currentAccount) {
            print("Account changed to: " + accounts[0]);
            currentAccount = accounts[0];
            updateUI();
            updateBalance();
            addToConnectedUsers(currentAccount);
        }
    });
    
    window.ethereum.on('chainChanged', function (chainId) {
        print("Network changed to chain ID: " + chainId);
        if (chainId !== XDC_NETWORK.chainId) {
            print("Warning: Not on XDC Apothem Testnet");
            showNotification('Please switch to XDC Apothem Testnet', 'warning');
        }
        // Reload page to ensure proper network handling
        window.location.reload();
    });
}

// ========================================
// FUNCTIONS CALLED DIRECTLY FROM HTML
// ========================================

// These functions are already defined in your original code:
// - connectWallet()
// - sendHashedMessage() 
// - getMessage()
// - verifyHash()
// - generateHashOnly()
// - refreshBalance()
// - disconnectWallet()
// - recoverConnection()
// - updateTransactionHistory()

// Additional functions that match your HTML onclick handlers:
window.refreshSenderInfo = refreshSenderInfo;
window.forceEventRefresh = forceEventRefresh;
window.performNetworkDiagnostics = performNetworkDiagnostics;
window.updateHashHistoryDisplay = updateHashHistoryDisplay;
window.exportHashHistory = exportHashHistory;
window.clearHashHistory = clearHashHistory;
window.validateHashIntegrity = validateHashIntegrity;
window.performHashBenchmark = performHashBenchmark;
window.checkNetworkStatus = checkNetworkStatus;
window.toggleAdvancedMode = toggleAdvancedMode;
window.updateConnectedUsers = updateConnectedUsers;
window.copyToClipboard = copyToClipboard;
window.clearOutput = clearOutput;

print("All functions loaded and perfectly matched to HTML interface");
