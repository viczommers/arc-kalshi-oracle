import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from web3 import Web3
from eth_account import Account
import os
from datetime import datetime
from typing import Optional
templates = Jinja2Templates(directory="templates")

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="KalshiLink Oracle Server")
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
RPC_URL = os.getenv("RPC_URL", "https://rpc.testnet.arc.network")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0xc1256868D57378ef0309928Dedce736815A8bC41")
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
                    {"internalType": "uint256", "name": "value", "type": "uint256"},
                    {"internalType": "uint256", "name": "submitterTimestamp", "type": "uint256"},
                    {"internalType": "uint256", "name": "resolutionTimestamp", "type": "uint256"},
                    {"internalType": "address", "name": "submitter", "type": "address"},
                    {"internalType": "uint256", "name": "blockNumber", "type": "uint256"}
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

# Initialize contract
contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)


class OracleData(BaseModel):
    value: int  # 1-99999 (percentage * 1000, e.g., 95000 = 95.000%)
    timestamp: Optional[int] = None  # Unix timestamp, defaults to now
    resolution_timestamp: int  # Unix timestamp for when market resolves


class OracleResponse(BaseModel):
    success: bool
    transaction_hash: Optional[str] = None
    message: str
    data: Optional[dict] = None


@app.get("/")
async def root():
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


@app.get("/oracle/info")
async def get_oracle_info():
    """Get oracle contract information"""
    try:
        name = contract.functions.name().call()
        owner = contract.functions.owner().call()
        next_index = contract.functions.nextIndexDataPoint().call()

        return {
            "name": name,
            "owner": owner,
            "total_data_points": next_index,
            "contract_address": CONTRACT_ADDRESS
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch oracle info: {str(e)}")


@app.get("/oracle/data/{index}")
async def get_data_point(index: int):
    """Get a specific data point by index"""
    try:
        data_point = contract.functions.getDataPoint(index).call()

        return {
            "index": index,
            "value": data_point[0],
            "value_percentage": data_point[0] / 1000,
            "submission_timestamp": data_point[1],
            "resolution_timestamp": data_point[2],
            "submitter": data_point[3],
            "block_number": data_point[4]
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
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)

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
