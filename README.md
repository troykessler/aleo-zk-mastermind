# Aleo Mastermind

Two-player Mastermind on Aleo testnet. Play with Shield Wallet. The secret code stays private until the game ends.

## Run locally (Node.js 24)

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

## Contract tests (Leo 4.4.6)

```sh
(cd contracts && leo test --network testnet)
python3 contracts/tests/test_devnode.py
```
