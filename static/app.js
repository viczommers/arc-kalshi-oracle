// MetaMask and Wallet Management
let provider;
let signer;
let userAddress;
let proportionsInterval = null;
let kalshiInterval = null;

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

// Token addresses
const MOCK_USDC_ADDRESS = '0xB0F5067211bBCBc4E8302E5b52939086d4397bBe';
const MOCK_EURC_ADDRESS = '0xd927Fe415c5e74F103A104A9313DDbae26125D1F';
const PST_TOKEN_ADDRESS = '0xF08388dd53031187497eD4c2EaBDb54a8aF5cb1E';
const ORACLE_CONTRACT_ADDRESS = '0xc1256868D57378ef0309928Dedce736815A8bC41';
const TREASURY_CONTRACT_ADDRESS = '0xB241a0d436446AAd90Be026306F2cdaE26FB712f';

// ERC20 ABI for approve and balanceOf functions
const ERC20_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "spender", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Treasury Management contract ABI
const TREASURY_ABI = [
    {
        "inputs": [],
        "name": "depositDualAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "withdrawAndBurn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "eurToUsdProportion",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "usdToEurProportion",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Check if ethers is loaded
console.log('Ethers loaded:', typeof ethers !== 'undefined');
console.log('MetaMask detected:', typeof window.ethereum !== 'undefined');

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const addPstTokenBtn = document.getElementById('addPstTokenBtn');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const networkName = document.getElementById('networkName');
const usdcBalance = document.getElementById('usdcBalance');
const eurcBalance = document.getElementById('eurcBalance');
const usdToEurProp = document.getElementById('usdToEurProp');
const eurToUsdProp = document.getElementById('eurToUsdProp');
const refreshBalances = document.getElementById('refreshBalances');
const getTokensBtn = document.getElementById('getTokensBtn');
const approveAndDepositBtn = document.getElementById('approveAndDepositBtn');
const approveAndWithdrawBtn = document.getElementById('approveAndWithdrawBtn');
const approveTokensBtn = document.getElementById('approveTokensBtn');
const depositAllBtn = document.getElementById('depositAllBtn');
const oracleForm = document.getElementById('oracleForm');
const submitBtn = document.getElementById('submitBtn');
const result = document.getElementById('result');

// Oracle Info
const contractAddress = document.getElementById('contractAddress');
const ownerAddress = document.getElementById('ownerAddress');
const totalDataPoints = document.getElementById('totalDataPoints');
const latestObservation = document.getElementById('latestObservation');

// Kalshi Market Data
const eurUsdRate = document.getElementById('eurUsdRate');
const kalshiProbability = document.getElementById('kalshiProbability');
const kalshiTicker = document.getElementById('kalshiTicker');

// Event Listeners
console.log('Setting up event listeners...');
connectBtn.addEventListener('click', () => {
    console.log('Connect button clicked!');
    connectWallet();
});
disconnectBtn.addEventListener('click', disconnectWallet);
addPstTokenBtn.addEventListener('click', addPstTokenToMetaMask);
refreshBalances.addEventListener('click', loadBalances);
getTokensBtn.addEventListener('click', mintTestTokens);
approveAndDepositBtn.addEventListener('click', approveAndDeposit);
approveAndWithdrawBtn.addEventListener('click', approveAndWithdraw);
approveTokensBtn.addEventListener('click', approveTokens);
depositAllBtn.addEventListener('click', depositAllTokens);
oracleForm.addEventListener('submit', submitOracleData);

// Initialize
window.addEventListener('load', () => {
    console.log('Window loaded, initializing...');
    loadOracleInfo();
    loadKalshiMarketData();

    // Set treasury contract address
    const treasuryContractEl = document.getElementById('treasuryContract');
    if (treasuryContractEl) {
        treasuryContractEl.textContent = `${TREASURY_CONTRACT_ADDRESS.substring(0, 6)}...${TREASURY_CONTRACT_ADDRESS.substring(38)} 🔗`;
        treasuryContractEl.href = `https://testnet.arcscan.app/address/${TREASURY_CONTRACT_ADDRESS}?tab=tokens`;
    }

    // Start auto-refresh for Kalshi data every 30 seconds
    kalshiInterval = setInterval(() => {
        loadKalshiMarketData();
    }, 30000);

    // Animate balance section accordion opening on page load
    setTimeout(() => {
        const balanceSection = document.querySelector('.balance-section');
        if (balanceSection) {
            balanceSection.classList.add('active');
        }
    }, 2000);

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
        approveAndDepositBtn.disabled = false;
        approveAndWithdrawBtn.disabled = false;
        approveTokensBtn.disabled = false;
        depositAllBtn.disabled = true; // Keep disabled until approvals
        submitBtn.disabled = false;

        // Auto-mint mock tokens matching real USDC/EURC balances
        await autoMintTokens();

        // Load balances (after minting)
        await loadBalances();

        // Start auto-refresh for treasury proportions every 5 seconds
        if (proportionsInterval) {
            clearInterval(proportionsInterval);
        }
        proportionsInterval = setInterval(() => {
            loadTreasuryProportions();
        }, 5000);

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

    // Stop auto-refresh interval
    if (proportionsInterval) {
        clearInterval(proportionsInterval);
        proportionsInterval = null;
    }

    connectBtn.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    refreshBalances.disabled = true;
    getTokensBtn.disabled = true;
    approveAndDepositBtn.disabled = true;
    approveAndWithdrawBtn.disabled = true;
    approveTokensBtn.disabled = true;
    depositAllBtn.disabled = true;
    submitBtn.disabled = true;

    usdcBalance.textContent = '--';
    eurcBalance.textContent = '--';
    usdToEurProp.textContent = '--';
    eurToUsdProp.textContent = '--';
}

async function addPstTokenToMetaMask() {
    try {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask to add tokens!');
            return;
        }

        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: PST_TOKEN_ADDRESS,
                    symbol: 'PST',
                    decimals: 18,
                    image: '',
                },
            },
        });

        if (wasAdded) {
            showResult('PST token added to MetaMask successfully!', 'success');
            setTimeout(() => result.classList.add('hidden'), 3000);
        }
    } catch (error) {
        console.error('Failed to add PST token:', error);
        showResult(`Failed to add token: ${error.message}`, 'error');
    }
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

        // Load treasury proportions
        await loadTreasuryProportions();
    } catch (error) {
        console.error('Failed to load balances:', error);
        showResult('Failed to load balances', 'error');
    }
}

async function autoMintTokens() {
    if (!userAddress) return;

    try {
        console.log('Auto-minting mock tokens matching real USDC/EURC balances...');
        const response = await fetch(`/mint-tokens?address=${userAddress}`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            console.log('Mock tokens minted successfully:', data.results);
        } else {
            console.warn('Failed to mint tokens:', data);
        }
    } catch (error) {
        console.error('Failed to auto-mint tokens:', error);
        // Silently fail - don't show error to user as this is automatic
    }
}

async function loadTreasuryProportions() {
    try {
        if (!provider) return;

        const treasuryContract = new ethers.Contract(
            TREASURY_CONTRACT_ADDRESS,
            TREASURY_ABI,
            provider
        );

        // Use blockTag 'latest' to get fresh data
        const [usdToEur, eurToUsd] = await Promise.all([
            treasuryContract.usdToEurProportion({ blockTag: 'latest' }),
            treasuryContract.eurToUsdProportion({ blockTag: 'latest' })
        ]);

        // Convert from wei (10^18) to percentage
        const usdToEurPercent = parseFloat(ethers.utils.formatUnits(usdToEur, 18));
        const eurToUsdPercent = parseFloat(ethers.utils.formatUnits(eurToUsd, 18));

        // Display proportions
        usdToEurProp.textContent = usdToEurPercent.toFixed(0);
        eurToUsdProp.textContent = eurToUsdPercent.toFixed(0);
    } catch (error) {
        console.error('Failed to load treasury proportions:', error);
        usdToEurProp.textContent = 'Error';
        eurToUsdProp.textContent = 'Error';
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

async function approveAndDeposit() {
    if (!signer) {
        showResult('Please connect your wallet first', 'error');
        return;
    }

    approveAndDepositBtn.disabled = true;
    approveAndDepositBtn.textContent = 'Step 1/3: Approving USDC...';

    try {
        let usdcApproved = false;
        let eurcApproved = false;

        // Step 1: Approve Mock USDC
        try {
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20_ABI, signer);
            const usdcBalance = await usdcContract.balanceOf(userAddress);

            if (usdcBalance.gt(0)) {
                const usdcTx = await usdcContract.approve(TREASURY_CONTRACT_ADDRESS, usdcBalance);
                await usdcTx.wait();
                usdcApproved = true;
            }
        } catch (error) {
            console.error('USDC approval error:', error);
            showResult('USDC approval failed', 'error');
            approveAndDepositBtn.disabled = false;
            approveAndDepositBtn.textContent = 'Approve & Deposit All';
            return;
        }

        // Step 2: Approve Mock EURC
        approveAndDepositBtn.textContent = 'Step 2/3: Approving EURC...';
        try {
            const eurcContract = new ethers.Contract(MOCK_EURC_ADDRESS, ERC20_ABI, signer);
            const eurcBalance = await eurcContract.balanceOf(userAddress);

            if (eurcBalance.gt(0)) {
                const eurcTx = await eurcContract.approve(TREASURY_CONTRACT_ADDRESS, eurcBalance);
                await eurcTx.wait();
                eurcApproved = true;
            }
        } catch (error) {
            console.error('EURC approval error:', error);
            showResult('EURC approval failed', 'error');
            approveAndDepositBtn.disabled = false;
            approveAndDepositBtn.textContent = 'Approve & Deposit All';
            return;
        }

        // Step 3: Deposit and mint PST
        if (usdcApproved && eurcApproved) {
            approveAndDepositBtn.textContent = 'Step 3/3: Depositing...';

            const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, signer);
            const tx = await treasuryContract.depositDualAll();

            showResult('Transaction submitted! Waiting for confirmation...', 'success');

            const receipt = await tx.wait();

            showResult(
                `Success! PST tokens minted!<br>Transaction: ${receipt.transactionHash.substring(0, 10)}...<br>Block: ${receipt.blockNumber}`,
                'success'
            );

            // Refresh balances after deposit
            setTimeout(() => loadBalances(), 2000);
        }
    } catch (error) {
        console.error('Failed to approve and deposit:', error);
        showResult(`Failed: ${error.message}`, 'error');
    } finally {
        approveAndDepositBtn.disabled = false;
        approveAndDepositBtn.textContent = 'Approve & Deposit All';
    }
}

async function approveTokens() {
    if (!signer) {
        showResult('Please connect your wallet first', 'error');
        return;
    }

    approveTokensBtn.disabled = true;
    approveTokensBtn.textContent = 'Approving...';

    try {
        let approvalResults = [];

        // Approve Mock USDC
        try {
            const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, ERC20_ABI, signer);

            // Get user's Mock USDC balance
            const usdcBalance = await usdcContract.balanceOf(userAddress);

            if (usdcBalance.gt(0)) {
                const usdcTx = await usdcContract.approve(TREASURY_CONTRACT_ADDRESS, usdcBalance);
                await usdcTx.wait();

                // Format balance for display
                const usdcBalanceFormatted = ethers.utils.formatUnits(usdcBalance, 18);
                approvalResults.push(`Mock USDC approved: ${parseFloat(usdcBalanceFormatted).toFixed(2)}`);

                // Enable deposit button after approval
                depositAllBtn.disabled = false;
            } else {
                approvalResults.push('Mock USDC: No balance to approve');
            }
        } catch (error) {
            console.error('USDC approval error:', error);
            approvalResults.push('Mock USDC approval failed');
        }

        // Approve Mock EURC
        try {
            const eurcContract = new ethers.Contract(MOCK_EURC_ADDRESS, ERC20_ABI, signer);

            // Get user's Mock EURC balance
            const eurcBalance = await eurcContract.balanceOf(userAddress);

            if (eurcBalance.gt(0)) {
                const eurcTx = await eurcContract.approve(TREASURY_CONTRACT_ADDRESS, eurcBalance);
                await eurcTx.wait();

                // Format balance for display
                const eurcBalanceFormatted = ethers.utils.formatUnits(eurcBalance, 18);
                approvalResults.push(`Mock EURC approved: ${parseFloat(eurcBalanceFormatted).toFixed(2)}`);

                // Enable deposit button after approval
                depositAllBtn.disabled = false;
            } else {
                approvalResults.push('Mock EURC: No balance to approve');
            }
        } catch (error) {
            console.error('EURC approval error:', error);
            approvalResults.push('Mock EURC approval failed');
        }

        showResult(
            `Approval complete!<br>${approvalResults.join('<br>')}`,
            'success'
        );
    } catch (error) {
        console.error('Failed to approve tokens:', error);
        showResult(`Failed to approve tokens: ${error.message}`, 'error');
    } finally {
        approveTokensBtn.disabled = false;
        approveTokensBtn.textContent = 'Approve Only';
    }
}

async function depositAllTokens() {
    if (!signer) {
        showResult('Please connect your wallet first', 'error');
        return;
    }

    depositAllBtn.disabled = true;
    depositAllBtn.textContent = 'Depositing...';

    try {
        // Create Treasury contract instance
        const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, signer);

        // Call depositDualAll
        const tx = await treasuryContract.depositDualAll();

        showResult('Transaction submitted! Waiting for confirmation...', 'success');

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        showResult(
            `All tokens deposited successfully!<br>Transaction: ${receipt.transactionHash.substring(0, 10)}...<br>Block: ${receipt.blockNumber}`,
            'success'
        );

        // Refresh balances after deposit
        setTimeout(() => loadBalances(), 2000);
    } catch (error) {
        console.error('Failed to deposit tokens:', error);
        showResult(`Failed to deposit tokens: ${error.message}`, 'error');
    } finally {
        depositAllBtn.disabled = false;
        depositAllBtn.textContent = 'Deposit Only';
    }
}

async function approveAndWithdraw() {
    if (!signer) {
        showResult('Please connect your wallet first', 'error');
        return;
    }

    approveAndWithdrawBtn.disabled = true;
    approveAndWithdrawBtn.textContent = 'Step 1/2: Approving PST...';

    try {
        // Step 1: Get PST balance and approve
        const pstContract = new ethers.Contract(PST_TOKEN_ADDRESS, ERC20_ABI, signer);
        const pstBalance = await pstContract.balanceOf(userAddress);

        if (pstBalance.eq(0)) {
            showResult('You have no PST tokens to withdraw', 'error');
            approveAndWithdrawBtn.disabled = false;
            approveAndWithdrawBtn.textContent = 'Approve & Withdraw PST';
            return;
        }

        // Calculate half of PST balance
        const halfPstBalance = pstBalance.div(2);

        // Approve Treasury to spend half of PST
        try {
            const approveTx = await pstContract.approve(TREASURY_CONTRACT_ADDRESS, halfPstBalance);
            await approveTx.wait();
        } catch (error) {
            console.error('PST approval error:', error);
            showResult('PST approval failed', 'error');
            approveAndWithdrawBtn.disabled = false;
            approveAndWithdrawBtn.textContent = 'Approve & Withdraw PST';
            return;
        }

        // Step 2: Withdraw and burn half of PST
        approveAndWithdrawBtn.textContent = 'Step 2/2: Withdrawing...';

        const treasuryContract = new ethers.Contract(TREASURY_CONTRACT_ADDRESS, TREASURY_ABI, signer);
        const tx = await treasuryContract.withdrawAndBurn(halfPstBalance);

        showResult('Transaction submitted! Waiting for confirmation...', 'success');

        const receipt = await tx.wait();

        // Format PST amount for display
        const pstBalanceFormatted = ethers.utils.formatUnits(halfPstBalance, 18);

        showResult(
            `Success! ${parseFloat(pstBalanceFormatted).toFixed(2)} PST burned!<br>USDC and EURC returned to your wallet<br>Transaction: ${receipt.transactionHash.substring(0, 10)}...<br>Block: ${receipt.blockNumber}`,
            'success'
        );

        // Refresh balances after withdrawal
        setTimeout(() => loadBalances(), 2000);
    } catch (error) {
        console.error('Failed to withdraw:', error);
        showResult(`Failed to withdraw: ${error.message}`, 'error');
    } finally {
        approveAndWithdrawBtn.disabled = false;
        approveAndWithdrawBtn.textContent = 'Approve & Withdraw PST';
    }
}

async function loadOracleInfo() {
    try {
        const response = await fetch('/oracle/info');
        const data = await response.json();

        contractAddress.textContent = `${data.contract_address.substring(0, 6)}...${data.contract_address.substring(38)} 🔗`;
        contractAddress.href = `https://testnet.arcscan.app/address/${data.contract_address}`;
        ownerAddress.textContent = `${data.owner.substring(0, 6)}...${data.owner.substring(38)} 🔗`;
        ownerAddress.href = `https://testnet.arcscan.app/address/${data.owner}`;
        totalDataPoints.textContent = data.total_data_points;

        // Display latest observation if available
        if (data.latest_observation !== undefined && data.latest_observation !== null) {
            // Convert from contract format (value * 1000) to percentage
            const percentage = data.latest_observation / 1000;
            latestObservation.textContent = `${percentage.toFixed(3)}%`;
        } else {
            latestObservation.textContent = 'No data yet';
        }
    } catch (error) {
        console.error('Failed to load oracle info:', error);
        contractAddress.textContent = 'Error';
        contractAddress.href = '#';
        ownerAddress.textContent = 'Error';
        totalDataPoints.textContent = 'Error';
        latestObservation.textContent = 'Error';
    }
}

async function loadKalshiMarketData() {
    try {
        const response = await fetch('/kalshi/market');
        const data = await response.json();

        if (data.success && data.market) {
            const market = data.market;

            // Display EUR/USD rate
            eurUsdRate.textContent = market.price || 'N/A';

            // Display probability as percentage
            const prob = market.probability;
            if (prob !== null && prob !== undefined) {
                kalshiProbability.textContent = `${(prob * 100).toFixed(2)}%`;
            } else {
                kalshiProbability.textContent = 'N/A';
            }

            // Display ticker
            if (market.ticker) {
                kalshiTicker.textContent = `${market.ticker} 🔗`;
                // Use event_ticker from the event object for the URL
                const eventId = market.event?.event_ticker || market.ticker;
                kalshiTicker.href = `https://demo.kalshi.co/markets/kxeurusd/eurusd-daily-range/${eventId.toLowerCase()}`;
            } else {
                kalshiTicker.textContent = 'N/A';
                kalshiTicker.href = '#';
            }
        } else {
            eurUsdRate.textContent = 'No data';
            kalshiProbability.textContent = 'No data';
            kalshiTicker.textContent = 'No data';
            kalshiTicker.href = '#';
        }
    } catch (error) {
        console.error('Failed to load Kalshi market data:', error);
        eurUsdRate.textContent = 'Error';
        kalshiProbability.textContent = 'Error';
        kalshiTicker.textContent = 'Error';
        kalshiTicker.href = '#';
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

// ASCII Wave Pattern Animation
class FluidAnimation {
    constructor() {
        this.chars = [
            ' ', ' ', '.', '·', '░', '░', '░', '░', '▒', '▒', '▒', '▒', '▓', '▓', '▓', '█', '▀', '▄', '▌', '▐', '■', '□', '□', '□', '□', '▪', '▫', '▫', '▫', '▫', '▬'
        ];
        this.canvas = document.getElementById('asciiCanvas');
        this.width = 0;
        this.height = 0;
        this.time = 0;
        this.init();
    }

    init() {
        this.updateDimensions();
        this.animate();
        window.addEventListener('resize', () => this.updateDimensions());
    }

    updateDimensions() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const testElement = document.createElement('div');
        testElement.style.position = 'absolute';
        testElement.style.top = '-1000px';
        testElement.style.left = '-1000px';
        testElement.style.fontFamily = 'Courier New, monospace';
        testElement.style.fontSize = '12px';
        testElement.style.lineHeight = '1';
        testElement.style.letterSpacing = '0';
        testElement.style.whiteSpace = 'pre';
        testElement.textContent = 'M';

        document.body.appendChild(testElement);
        const rect = testElement.getBoundingClientRect();
        const actualCharWidth = rect.width;
        const actualCharHeight = rect.height;
        document.body.removeChild(testElement);

        this.width = Math.ceil(viewportWidth / actualCharWidth);
        this.height = Math.ceil(viewportHeight / actualCharHeight);
    }

    renderWaves() {
        let result = '';

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Multiple wave layers
                const wave1 = Math.sin(x * 0.15 + this.time * 0.08);
                const wave2 = Math.sin(y * 0.1 + this.time * 0.05);
                const wave3 = Math.cos(x * 0.08 - y * 0.08 + this.time * 0.06);
                const wave4 = Math.sin((x + y) * 0.05 + this.time * 0.04);

                // Radial wave from center
                const centerX = this.width / 2;
                const centerY = this.height / 2;
                const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                const radialWave = Math.sin(dist * 0.3 - this.time * 0.1);

                // Diagonal flowing wave
                const diagonalWave = Math.sin((x - y) * 0.12 + this.time * 0.07);

                // Combine all waves
                const combined = (wave1 + wave2 + wave3 + wave4 + radialWave + diagonalWave) / 6;

                // Convert to 0-1 range
                const value = (combined + 1) / 2;

                // Apply some noise/variation
                const noise = Math.sin(x * 2.5 + y * 3.7 + this.time * 0.02) * 0.05;
                const finalValue = Math.max(0, Math.min(1, value + noise));

                // Map to character
                const charIndex = Math.floor(finalValue * (this.chars.length - 1));
                result += this.chars[charIndex];
            }
            result += '\n';
        }

        this.canvas.textContent = result;
    }

    animate() {
        this.time += 1;

        const frameRate = 25;
        const frameDelay = 1000 / frameRate;

        setTimeout(() => {
            this.renderWaves();
            requestAnimationFrame(() => this.animate());
        }, frameDelay);
    }
}

// Text scrambling animation
function scrambleText(element, finalText, duration = 2000) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let iteration = 0;

    const totalSteps = finalText.length * 4;
    const intervalTime = duration / totalSteps;

    const interval = setInterval(() => {
        element.textContent = finalText
            .split('')
            .map((char, index) => {
                if (index < iteration) {
                    return finalText[index];
                }
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

        if (iteration >= finalText.length) {
            clearInterval(interval);
            element.classList.add('revealed');
        }

        iteration += 1 / 4;
    }, intervalTime);
}

// Initialize ASCII wave animation on load
if (document.getElementById('asciiCanvas')) {
    new FluidAnimation();
}

// Initialize text scramble animation
if (document.getElementById('word1') && document.getElementById('word2')) {
    scrambleText(document.getElementById('word1'), 'DELPHI', 2000);
    scrambleText(document.getElementById('word2'), 'POOL', 2000);
}

// Accordion functionality
const accordionItems = document.querySelectorAll('.accordion-item');

accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');

    if (header) {
        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            accordionItems.forEach(i => i.classList.remove('active'));
            if (!isActive) {
                item.classList.add('active');
            }
        });
    }
});
