# Aleo Mastermind

Two-player Mastermind on Aleo testnet, played with Shield Wallet. One player hides four colored pegs. The other has ten guesses to find them in the right order.

## Why zero knowledge?

How can you check a clue when you can’t see the secret code? At the start of the game, the codemaker’s wallet receives a private Aleo record called `Solution`. It holds the four colors and the game ID.

Each guess is public. To score it, the codemaker uses that same secret code to prove how many pegs match exactly and how many have the right color in the wrong spot. Aleo verifies the proof and records the clue on the board. The secret code becomes public when the game ends.

## Build and test the contract

Install Leo 4.4.6 with Cargo (part of the Rust toolchain).

```sh
cargo install leo-lang --version 4.4.6 --locked
leo --version
```

From the repository root, build the contract and run its Leo tests.

```sh
leo build --path contracts --network testnet
leo test --path contracts --network testnet
```

To play through full games on a temporary local node, run the integration tests with Python 3 and npm.

```sh
python3 contracts/tests/test_devnode.py
```

## Run the frontend

With Node.js 24 installed, run these commands from the repository root.

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open the local URL printed by Vite and connect Shield Wallet to play on testnet.
