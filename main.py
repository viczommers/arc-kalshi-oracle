import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from web3 import Web3
from eth_account import Account
from datetime import datetime
from typing import Optional
import asyncio
import logging
templates = Jinja2Templates(directory="templates")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os
# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Import Kalshi client
from kalshi_client import get_latest_maket

app = FastAPI(title="Kalshi Oracle x Circle")
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def run_scheduler():
    """Background task that runs the oracle update every 5 minutes"""
    while True:
        try:
            await scheduled_oracle_update()
        except Exception as e:
            logger.error(f"Error in scheduler loop: {str(e)}")

        # Wait 5 minutes before next run
        await asyncio.sleep(300)  # 300 seconds = 5 minutes


@app.on_event("startup")
async def startup_event():
    """Start the background scheduler when the app starts"""
    logger.info("Starting background scheduler...")
    asyncio.create_task(run_scheduler())
    logger.info("Scheduler started. Oracle updates will run every 5 minutes.")

# Configuration
RPC_URL = "https://rpc.testnet.arc.network"
# Token addresses on ARC Testnet
USDC_ADDRESS = "0x3600000000000000000000000000000000000000"  # Update with actual USDC address
EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"  # Update with actual EURC address
# Mock token addresses for testing
MOCK_USDC_ADDRESS = "0xB0F5067211bBCBc4E8302E5b52939086d4397bBe"  # Update with deployed Mock USDC address
MOCK_EURC_ADDRESS = "0xd927Fe415c5e74F103A104A9313DDbae26125D1F"  # Update with deployed Mock EURC address
CONTRACT_ADDRESS = "0xc1256868D57378ef0309928Dedce736815A8bC41"
TREASURY_CONTRACT_ADDRESS = "0xB241a0d436446AAd90Be026306F2cdaE26FB712f"
PRIVATE_KEY = os.getenv("PRIVATE_KEY")  # Set via environment variable

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Contract ABI - simplified for the fulfillPredictionMarketDataEurUsd function
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "_value", "type": "uint256"},
            {"internalType": "uint256", "name": "_timestamp", "type": "uint256"},
            {"internalType": "uint256", "name": "_resolutionTimestamp", "type": "uint256"}
        ],
        "name": "fulfillPredictionMarketDataEurUsd",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextIndexDataPoint",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_index", "type": "uint256"}],
        "name": "getDataPoint",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "submitter", "type": "address"},
                    {"internalType": "uint256", "name": "submitterTimestamp", "type": "uint256"},
                    {"internalType": "uint256", "name": "blockNumber", "type": "uint256"},
                    {"internalType": "uint256", "name": "value", "type": "uint256"},
                    {"internalType": "uint256", "name": "resolutionTimestamp", "type": "uint256"}
                ],
                "internalType": "struct KalshiLinkOracle.DataPoint",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# ERC20 Token ABI for balance checking and minting
ERC20_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# Treasury Management contract ABI
TREASURY_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "_targetUsdPerc", "type": "uint256"}],
        "name": "reBalance",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "usdToEurProportion",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "eurToUsdProportion",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Initialize contracts
contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
treasury_contract = w3.eth.contract(address=Web3.to_checksum_address(TREASURY_CONTRACT_ADDRESS), abi=TREASURY_ABI)


# Scheduled task to fetch Kalshi data, submit to oracle, and rebalance treasury
async def scheduled_oracle_update():
    """
    Scheduled task that runs every 5 minutes to:
    1. Fetch latest Kalshi market data
    2. Submit to oracle contract
    3. Rebalance treasury based on market data
    """
    try:
        logger.info("Starting scheduled oracle update...")

        if not PRIVATE_KEY:
            logger.error("Private key not configured, skipping scheduled update")
            return

        # Get account from private key
        account = Account.from_key(PRIVATE_KEY)

        # Step 1: Fetch Kalshi market data
        try:
            market_data = get_latest_maket()
            if not market_data:
                logger.warning("No Kalshi market data found, skipping update")
                return

            price = market_data.get('price')
            probability = market_data.get('probability')
            ticker = market_data.get('ticker')

            logger.info(f"Fetched Kalshi market - Ticker: {ticker}, Price: {price}, Probability: {probability:.2%}")

            # Convert price string to float (e.g., '1.163' -> 1.163)
            # This represents the EUR/USD exchange rate
            price_float = float(price)

            # Calculate target USD percentage based on EUR/USD exchange rate
            # Formula: USD% = 100 / EUR/USD rate
            # Example: EUR/USD = 1.163 → USD% = 100 / 1.163 = 86%
            # Higher EUR/USD (strong EUR) → Lower USD%
            # Lower EUR/USD (weak EUR) → Higher USD%
            target_usd_perc = 100 / price_float

            # Ensure target is in valid range (1-99%)
            target_usd_perc = int(max(1, min(99, target_usd_perc)))

            # Convert target USD percentage to oracle format (percentage * 1000)
            # For 37% USD, this would be 37000
            oracle_value = int(target_usd_perc * 1000)

            # Ensure value is in valid range
            oracle_value = max(1, min(99999, oracle_value))

            logger.info(f"Calculated oracle value - EUR/USD: {price_float}, Target USD%: {target_usd_perc}%, Oracle value: {oracle_value}")

        except Exception as e:
            logger.error(f"Failed to fetch Kalshi data: {str(e)}")
            return

        # Step 2: Submit data to oracle
        try:
            current_time = int(datetime.now().timestamp())
            resolution_time = current_time + (24 * 60 * 60)  # 24 hours from now

            nonce = w3.eth.get_transaction_count(account.address)

            # Estimate gas
            gas_estimate = contract.functions.fulfillPredictionMarketDataEurUsd(
                oracle_value,
                current_time,
                resolution_time
            ).estimate_gas({'from': account.address})

            # Build transaction
            transaction = contract.functions.fulfillPredictionMarketDataEurUsd(
                oracle_value,
                current_time,
                resolution_time
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': gas_estimate + 10000,
                'gasPrice': w3.eth.gas_price,
            })

            # Sign and send transaction
            signed_txn = account.sign_transaction(transaction)
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            logger.info(f"Oracle data submitted successfully. TX: {tx_hash.hex()}, Value: {oracle_value / 1000}%")

        except Exception as e:
            logger.error(f"Failed to submit oracle data: {str(e)}")
            return

        # Step 3: Rebalance treasury based on market data
        try:
            # Use the same target_usd_perc calculated above for oracle submission
            logger.info(f"Rebalancing treasury - EUR/USD: {price_float}, Target USD%: {target_usd_perc}%")

            nonce = w3.eth.get_transaction_count(account.address)

            # Estimate gas
            gas_estimate = treasury_contract.functions.reBalance(
                target_usd_perc
            ).estimate_gas({'from': account.address})

            # Build transaction
            transaction = treasury_contract.functions.reBalance(
                target_usd_perc
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': gas_estimate + 10000,
                'gasPrice': w3.eth.gas_price,
            })

            # Sign and send transaction
            signed_txn = account.sign_transaction(transaction)
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            logger.info(f"Treasury rebalanced successfully. TX: {tx_hash.hex()}, Target USD: {target_usd_perc}%")

        except Exception as e:
            logger.error(f"Failed to rebalance treasury: {str(e)}")
            return

        logger.info("Scheduled oracle update completed successfully")

    except Exception as e:
        logger.error(f"Error in scheduled oracle update: {str(e)}")


class OracleData(BaseModel):
    value: int  # 1-99999 (percentage * 1000, e.g., 95000 = 95.000%)
    timestamp: Optional[int] = None  # Unix timestamp, defaults to now
    resolution_timestamp: int  # Unix timestamp for when market resolves


class OracleResponse(BaseModel):
    success: bool
    transaction_hash: Optional[str] = None
    message: str
    data: Optional[dict] = None


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main web interface"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api")
async def api_info():
    """API information endpoint"""
    return {
        "service": "KalshiLink Oracle Server",
        "version": "1.0.0",
        "chain": "Arc Testnet",
        "contract": CONTRACT_ADDRESS
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        is_connected = w3.is_connected()
        block_number = w3.eth.block_number if is_connected else None

        return {
            "status": "healthy" if is_connected else "unhealthy",
            "rpc_connected": is_connected,
            "current_block": block_number,
            "contract_address": CONTRACT_ADDRESS
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@app.get("/balance")
async def get_token_balances(address: Optional[str] = None):
    """Get Mock USDC and EURC token balances for an address on ARC Testnet"""
    # Default to the specified address if none provided
    target_address = address or "0x420694f95287e8552cdc2e7d68e81a294f23035e"

    try:
        # Convert to checksum address
        checksum_address = Web3.to_checksum_address(target_address)

        balances = {}

        # Get Mock USDC balance
        if MOCK_USDC_ADDRESS != "0x0000000000000000000000000000000000000000":
            try:
                usdc_contract = w3.eth.contract(
                    address=Web3.to_checksum_address(MOCK_USDC_ADDRESS),
                    abi=ERC20_ABI
                )
                usdc_balance = usdc_contract.functions.balanceOf(checksum_address).call()
                usdc_decimals = usdc_contract.functions.decimals().call()
                usdc_symbol = usdc_contract.functions.symbol().call()

                balances["USDC"] = {
                    "symbol": usdc_symbol,
                    "balance_raw": str(usdc_balance),
                    "balance": str(usdc_balance / (10 ** usdc_decimals)),
                    "decimals": usdc_decimals,
                    "contract_address": MOCK_USDC_ADDRESS
                }
            except Exception as e:
                balances["USDC"] = {"error": str(e)}

        # Get Mock EURC balance
        if MOCK_EURC_ADDRESS != "0x0000000000000000000000000000000000000000":
            try:
                eurc_contract = w3.eth.contract(
                    address=Web3.to_checksum_address(MOCK_EURC_ADDRESS),
                    abi=ERC20_ABI
                )
                eurc_balance = eurc_contract.functions.balanceOf(checksum_address).call()
                eurc_decimals = eurc_contract.functions.decimals().call()
                eurc_symbol = eurc_contract.functions.symbol().call()

                balances["EURC"] = {
                    "symbol": eurc_symbol,
                    "balance_raw": str(eurc_balance),
                    "balance": str(eurc_balance / (10 ** eurc_decimals)),
                    "decimals": eurc_decimals,
                    "contract_address": MOCK_EURC_ADDRESS
                }
            except Exception as e:
                balances["EURC"] = {"error": str(e)}

        return {
            "address": checksum_address,
            "chain": "Arc Testnet",
            "balances": balances
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch balances: {str(e)}")


@app.post("/mint-tokens")
async def mint_test_tokens(address: str):
    """Mint Mock USDC and EURC tokens matching the user's real token balances"""

    # Validate private key is configured
    if not PRIVATE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Private key not configured. Set PRIVATE_KEY environment variable."
        )

    try:
        # Convert to checksum address
        checksum_address = Web3.to_checksum_address(address)

        # Get account from private key
        account = Account.from_key(PRIVATE_KEY)

        results = {}

        # Get real USDC balance and mint matching Mock USDC
        if MOCK_USDC_ADDRESS != "0x0000000000000000000000000000000000000000":
            try:
                mock_usdc_contract = w3.eth.contract(
                    address=Web3.to_checksum_address(MOCK_USDC_ADDRESS),
                    abi=ERC20_ABI
                )

                # Get real USDC balance
                if USDC_ADDRESS != "0x0000000000000000000000000000000000000000":
                    real_usdc_contract = w3.eth.contract(
                        address=Web3.to_checksum_address(USDC_ADDRESS),
                        abi=ERC20_ABI
                    )
                    real_usdc_balance = real_usdc_contract.functions.balanceOf(checksum_address).call()
                    real_usdc_decimals = real_usdc_contract.functions.decimals().call()

                    # Multiply by 10^12 to convert from 6 decimals to 18 decimals
                    mock_usdc_mint_amount = real_usdc_balance * (10 ** 12)
                    usdc_balance_formatted = real_usdc_balance / (10 ** real_usdc_decimals)
                else:
                    # Default to 1000 if no real USDC address configured
                    usdc_balance_formatted = 1000
                    mock_usdc_mint_amount = 1000 * (10 ** 18)

                # Build mint transaction for Mock USDC
                nonce = w3.eth.get_transaction_count(account.address)
                gas_estimate = mock_usdc_contract.functions.mint(
                    checksum_address,
                    mock_usdc_mint_amount
                ).estimate_gas({'from': account.address})

                transaction = mock_usdc_contract.functions.mint(
                    checksum_address,
                    mock_usdc_mint_amount
                ).build_transaction({
                    'from': account.address,
                    'nonce': nonce,
                    'gas': gas_estimate + 10000,
                    'gasPrice': w3.eth.gas_price,
                })

                # Sign and send transaction
                signed_txn = account.sign_transaction(transaction)
                tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
                tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

                results["USDC"] = {
                    "success": tx_receipt['status'] == 1,
                    "transaction_hash": tx_hash.hex(),
                    "amount": str(usdc_balance_formatted),
                    "matched_real_balance": True
                }
            except Exception as e:
                results["USDC"] = {"error": str(e)}

        # Get real EURC balance and mint matching Mock EURC
        if MOCK_EURC_ADDRESS != "0x0000000000000000000000000000000000000000":
            try:
                mock_eurc_contract = w3.eth.contract(
                    address=Web3.to_checksum_address(MOCK_EURC_ADDRESS),
                    abi=ERC20_ABI
                )

                # Get real EURC balance
                if EURC_ADDRESS != "0x0000000000000000000000000000000000000000":
                    real_eurc_contract = w3.eth.contract(
                        address=Web3.to_checksum_address(EURC_ADDRESS),
                        abi=ERC20_ABI
                    )
                    real_eurc_balance = real_eurc_contract.functions.balanceOf(checksum_address).call()
                    real_eurc_decimals = real_eurc_contract.functions.decimals().call()

                    # Multiply by 10^12 to convert from 6 decimals to 18 decimals
                    mock_eurc_mint_amount = real_eurc_balance * (10 ** 12)
                    eurc_balance_formatted = real_eurc_balance / (10 ** real_eurc_decimals)
                else:
                    # Default to 1000 if no real EURC address configured
                    eurc_balance_formatted = 1000
                    mock_eurc_mint_amount = 1000 * (10 ** 18)

                # Build mint transaction for Mock EURC
                nonce = w3.eth.get_transaction_count(account.address)
                gas_estimate = mock_eurc_contract.functions.mint(
                    checksum_address,
                    mock_eurc_mint_amount
                ).estimate_gas({'from': account.address})

                transaction = mock_eurc_contract.functions.mint(
                    checksum_address,
                    mock_eurc_mint_amount
                ).build_transaction({
                    'from': account.address,
                    'nonce': nonce,
                    'gas': gas_estimate + 10000,
                    'gasPrice': w3.eth.gas_price,
                })

                # Sign and send transaction
                signed_txn = account.sign_transaction(transaction)
                tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
                tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

                results["EURC"] = {
                    "success": tx_receipt['status'] == 1,
                    "transaction_hash": tx_hash.hex(),
                    "amount": str(eurc_balance_formatted),
                    "matched_real_balance": True
                }
            except Exception as e:
                results["EURC"] = {"error": str(e)}

        return {
            "success": True,
            "address": checksum_address,
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mint tokens: {str(e)}")


@app.get("/kalshi/market")
async def get_kalshi_market():
    """Test endpoint to get today's Kalshi market"""
    try:
        market = get_latest_maket()

        if market:
            return {
                "success": True,
                "market": market
            }
        else:
            return {
                "success": False,
                "message": "No market found"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Kalshi market: {str(e)}")


@app.get("/oracle/info")
async def get_oracle_info():
    """Get oracle contract information"""
    try:
        name = contract.functions.name().call()
        owner = contract.functions.owner().call()
        next_index = contract.functions.nextIndexDataPoint().call()

        # Get latest observation if there are any data points
        latest_observation = None
        if next_index > 0:
            try:
                data_point = contract.functions.getDataPoint(next_index - 1).call()
                # DataPoint struct: (submitter, submitterTimestamp, blockNumber, value, resolutionTimestamp)
                latest_observation = data_point[3]  # value is at index 3
            except Exception as e:
                print(f"Failed to fetch latest data point: {e}")

        return {
            "name": name,
            "owner": owner,
            "total_data_points": next_index,
            "contract_address": CONTRACT_ADDRESS,
            "latest_observation": latest_observation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch oracle info: {str(e)}")


@app.get("/oracle/data/{index}")
async def get_data_point(index: int):
    """Get a specific data point by index"""
    try:
        data_point = contract.functions.getDataPoint(index).call()
        # DataPoint struct: (submitter, submitterTimestamp, blockNumber, value, resolutionTimestamp)

        return {
            "index": index,
            "submitter": data_point[0],
            "submission_timestamp": data_point[1],
            "block_number": data_point[2],
            "value": data_point[3],
            "value_percentage": data_point[3] / 1000,
            "resolution_timestamp": data_point[4]
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Data point not found: {str(e)}")


@app.post("/oracle/submit", response_model=OracleResponse)
async def submit_oracle_data(data: OracleData):
    """Submit new EUR/USD prediction market data to the oracle"""

    # Validate private key is configured
    if not PRIVATE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Private key not configured. Set PRIVATE_KEY environment variable."
        )

    # Validate value range
    if not 1 <= data.value <= 99999:
        raise HTTPException(
            status_code=400,
            detail="Value must be between 1 and 99999"
        )

    try:
        # Get account from private key
        account = Account.from_key(PRIVATE_KEY)

        # Use current timestamp if not provided
        timestamp = data.timestamp if data.timestamp else int(datetime.now().timestamp())

        # Build transaction
        nonce = w3.eth.get_transaction_count(account.address)

        # Estimate gas
        gas_estimate = contract.functions.fulfillPredictionMarketDataEurUsd(
            data.value,
            timestamp,
            data.resolution_timestamp
        ).estimate_gas({'from': account.address})

        # Build transaction
        transaction = contract.functions.fulfillPredictionMarketDataEurUsd(
            data.value,
            timestamp,
            data.resolution_timestamp
        ).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': gas_estimate + 10000,  # Add buffer
            'gasPrice': w3.eth.gas_price,
        })

        # Sign transaction
        signed_txn = account.sign_transaction(transaction)

        # Send transaction
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)

        # Wait for transaction receipt
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        return OracleResponse(
            success=tx_receipt['status'] == 1,
            transaction_hash=tx_hash.hex(),
            message="Data submitted successfully" if tx_receipt['status'] == 1 else "Transaction failed",
            data={
                "value": data.value,
                "value_percentage": data.value / 1000,
                "timestamp": timestamp,
                "resolution_timestamp": data.resolution_timestamp,
                "block_number": tx_receipt['blockNumber'],
                "gas_used": tx_receipt['gasUsed']
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit data: {str(e)}")


@app.post("/oracle/submit-latest")
async def submit_latest_eur_usd():
    """
    Submit latest EUR/USD data with auto-populated fields.
    This endpoint can be called periodically to update the oracle.
    """

    # Example: You would fetch real EUR/USD data here from an API
    # For now, using placeholder values
    current_time = int(datetime.now().timestamp())
    resolution_time = current_time + (24 * 60 * 60)  # 24 hours from now

    # Example value: 95.5% = 95500
    value = 95500  # Replace with actual EUR/USD data fetch

    data = OracleData(
        value=value,
        timestamp=current_time,
        resolution_timestamp=resolution_time
    )

    return await submit_oracle_data(data)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
