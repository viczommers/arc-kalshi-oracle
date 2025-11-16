# Kalshi Oracle

This document is meant to describe in high-level how this project works.

At the core of this project there's the **TreasuryManager** smart contract. Connected to the treasury we have 3 tokens ( 1 mocked **wrapped USDC**, 1 mocked **EURC** and **Pool Share Token aka PST** ). Lastly we have the **KalshiLinkOracle** smart contract.

The normal flow is the following:

`0.` Set users, provider & others; `1.` Depl mocked USD; `2.` Depl mocked €; `3.` Depl PST; `4.` Depl TrezMgr; `5.` Mint 1USD; `6.` Mint 1€; `7.` ApproveSpendOfUSD; `8.` ApproveSpendOf€; `9.` DepositDualAll ( deposit USDC and € simultaneously and get Pool Share Tokens in proportion to how much you've deposited );

After that if the Admin wants to `10.` rebalance the portfolio to have, let's say, instead of 1 USD and 1 € it can do that by calling the reBalance function ( this also allows for the KalshiLinkOracle to do the same reBalancing automatically ). Finally the pool participant can withdraw `11.` his portion of the pie by burning his/her PST token(s) using the withdrawAndBurn function.

---

## Installation

Install with:

```sh
npm i
```

Copy over the .env.example end edit it

```sh
cp .env.example .env
```

Compile:

```sh
npm run compile
```

---

## Backend

Create the Python env variable

```sh
source venv/bin/activate
```

And then run the backend:

```sh
python main.py
```

---
