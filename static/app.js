// MetaMask and Wallet Management
let provider;
let signer;
let userAddress;

const ARC_TESTNET = {
    chainId: '0x4CEF52', // 314098 in decimal (Arc Testnet)
    chainName: 'Arc Testnet',
    rpcUrls: ['https://rpc.testnet.arc.network'],
    nativeCurrency: {
        name: 'ARC',
        symbol: 'ARC',
        decimals: 18
    },
    blockExplorerUrls: ['https://testnet.arcscan.com/']
};

// Check if ethers is loaded
console.log('Ethers loaded:', typeof ethers !== 'undefined');
console.log('MetaMask detected:', typeof window.ethereum !== 'undefined');

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const networkName = document.getElementById('networkName');
const usdcBalance = document.getElementById('usdcBalance');
const eurcBalance = document.getElementById('eurcBalance');
const refreshBalances = document.getElementById('refreshBalances');
const getTokensBtn = document.getElementById('getTokensBtn');
const oracleForm = document.getElementById('oracleForm');
const submitBtn = document.getElementById('submitBtn');
const result = document.getElementById('result');

// Oracle Info
const contractAddress = document.getElementById('contractAddress');
const ownerAddress = document.getElementById('ownerAddress');
const totalDataPoints = document.getElementById('totalDataPoints');

// Event Listeners
console.log('Setting up event listeners...');
connectBtn.addEventListener('click', () => {
    console.log('Connect button clicked!');
    connectWallet();
});
disconnectBtn.addEventListener('click', disconnectWallet);
refreshBalances.addEventListener('click', loadBalances);
getTokensBtn.addEventListener('click', mintTestTokens);
oracleForm.addEventListener('submit', submitOracleData);

// Initialize
window.addEventListener('load', () => {
    console.log('Window loaded, initializing...');
    loadOracleInfo();

    // Check if already connected
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
});

// MetaMask account/network change listeners
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            connectWallet();
        }
    });

    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask to use this application!');
            window.open('https://metamask.io/download/', '_blank');
            return;
        }

        // Request account access
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Check if on correct network
        const network = await provider.getNetwork();
        if (network.chainId !== 314098) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: ARC_TESTNET.chainId }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [ARC_TESTNET],
                        });
                    } catch (addError) {
                        console.error('Failed to add network:', addError);
                        showResult('Failed to add ARC Testnet to MetaMask', 'error');
                        return;
                    }
                } else {
                    console.error('Failed to switch network:', switchError);
                    showResult('Please switch to ARC Testnet in MetaMask', 'error');
                    return;
                }
            }
        }

        // Update UI
        walletAddress.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        networkName.textContent = 'Arc Testnet';

        connectBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
        refreshBalances.disabled = false;
        getTokensBtn.disabled = false;
        submitBtn.disabled = false;

        // Load balances
        await loadBalances();

        showResult('Wallet connected successfully!', 'success');
        setTimeout(() => result.classList.add('hidden'), 3000);
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        showResult(`Failed to connect: ${error.message}`, 'error');
    }
}

function disconnectWallet() {
    provider = null;
    signer = null;
    userAddress = null;

    connectBtn.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    refreshBalances.disabled = true;
    getTokensBtn.disabled = true;
    submitBtn.disabled = true;

    usdcBalance.textContent = '--';
    eurcBalance.textContent = '--';
}

async function loadBalances() {
    if (!userAddress) return;

    try {
        const response = await fetch(`/balance?address=${userAddress}`);
        const data = await response.json();

        if (data.balances.USDC) {
            usdcBalance.textContent = data.balances.USDC.error
                ? 'Error'
                : parseFloat(data.balances.USDC.balance).toFixed(2);
        }

        if (data.balances.EURC) {
            eurcBalance.textContent = data.balances.EURC.error
                ? 'Error'
                : parseFloat(data.balances.EURC.balance).toFixed(2);
        }
    } catch (error) {
        console.error('Failed to load balances:', error);
        showResult('Failed to load balances', 'error');
    }
}

async function mintTestTokens() {
    if (!userAddress) {
        showResult('Please connect your wallet first', 'error');
        return;
    }

    getTokensBtn.disabled = true;
    getTokensBtn.textContent = 'Minting...';

    try {
        const response = await fetch(`/mint-tokens?address=${userAddress}`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            let message = 'Test tokens minted successfully!<br>';

            if (data.results.USDC && data.results.USDC.success) {
                message += `USDC: ${data.results.USDC.amount} tokens<br>`;
            }
            if (data.results.EURC && data.results.EURC.success) {
                message += `EURC: ${data.results.EURC.amount} tokens<br>`;
            }

            showResult(message, 'success');

            // Refresh balances after minting
            setTimeout(() => loadBalances(), 2000);
        } else {
            showResult(`Error: ${data.detail || 'Failed to mint tokens'}`, 'error');
        }
    } catch (error) {
        console.error('Failed to mint tokens:', error);
        showResult(`Failed to mint tokens: ${error.message}`, 'error');
    } finally {
        getTokensBtn.disabled = false;
        getTokensBtn.textContent = 'Get Test Tokens';
    }
}

async function loadOracleInfo() {
    try {
        const response = await fetch('/oracle/info');
        const data = await response.json();

        contractAddress.textContent = data.contract_address;
        ownerAddress.textContent = `${data.owner.substring(0, 6)}...${data.owner.substring(38)}`;
        totalDataPoints.textContent = data.total_data_points;
    } catch (error) {
        console.error('Failed to load oracle info:', error);
        contractAddress.textContent = 'Error';
        ownerAddress.textContent = 'Error';
        totalDataPoints.textContent = 'Error';
    }
}

async function submitOracleData(e) {
    e.preventDefault();

    if (!userAddress) {
        showResult('Please connect your wallet first', 'error');
        return;
    }

    const value = parseInt(document.getElementById('valueInput').value);
    const resolutionDate = document.getElementById('resolutionTimestamp').value;
    const resolutionTimestamp = Math.floor(new Date(resolutionDate).getTime() / 1000);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const response = await fetch('/oracle/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                value: value,
                resolution_timestamp: resolutionTimestamp
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showResult(
                `Success! Transaction: ${data.transaction_hash.substring(0, 10)}...
                <br>Block: ${data.data.block_number}
                <br>Gas Used: ${data.data.gas_used}`,
                'success'
            );
            oracleForm.reset();
            loadOracleInfo(); // Refresh oracle info
        } else {
            showResult(`Error: ${data.detail || data.message}`, 'error');
        }
    } catch (error) {
        console.error('Failed to submit:', error);
        showResult(`Failed to submit: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Data';
    }
}

function showResult(message, type) {
    result.innerHTML = message;
    result.className = `result ${type}`;
    result.classList.remove('hidden');
}
