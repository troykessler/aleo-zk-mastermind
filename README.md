# Aleo Mastermind

The Leo program lives in `contracts/`. The React and TypeScript starter lives in `frontend/`. The lobby reads active games for the connected Shield address. Open `/game/<id>` to inspect a board, see whose turn it is, or copy its link.

## Run the frontend against public testnet

From the repo root, start the frontend with Node.js 24.

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. The frontend reads `mastermind.aleo` from public Aleo testnet through `https://api.explorer.provable.com/v1`. Shield supplies the player’s testnet address. Board links also work without connecting a wallet. Pick four colors on the home board, connect Shield, enter the codebreaker’s address, and approve creation. The transaction log shows Shield status updates and links to on-chain transaction IDs. Open **My games** to look up a game by ID or view active games. After testnet confirmation, the board opens with a **Copy game link** button. On the codebreaker’s turn, select four colors on the game page and choose **Submit guess with Shield**. Confirmed guesses appear on the board. The codemaker can then choose **Give feedback with Shield**. Shield selects the unspent solution record for that game and the contract calculates the feedback pegs. The board’s **Game history** shows confirmed moves to everyone with the link. On public testnet, indexed moves include their block times and explorer links.

## Use a local devnode

Use Leo 4.4.6 and Node.js 24. Check `leo --version` in the shell you use for deployment. If you keep a project-local CLI at `.tools/leo-4.4.6/bin/leo`, run `export PATH="$PWD/.tools/leo-4.4.6/bin:$PATH"` from the repository root first. [Leo 4.4.6 releases](https://github.com/ProvableHQ/leo/releases/tag/leo-lang-v4.4.6)

Start the devnode from the repo root in one terminal. The key below is the published, pre-funded **local development key**.

```sh
npx --yes @provablehq/aleo-devnode@0.4.0 start \
  --private-key APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH
```

In a second terminal, deploy from the contract directory. The default in-memory ledger starts fresh each time the node starts.

```sh
cd contracts
leo deploy --network testnet --devnet --endpoint http://127.0.0.1:3030 \
  --private-key APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH \
  --skip-deploy-certificate --broadcast --yes
```

To point the frontend at this ledger, run from the repo root.

```sh
cd frontend
VITE_ALEO_ENDPOINT=http://127.0.0.1:3030 npm run dev
```

For a persistent override, set `VITE_ALEO_ENDPOINT` (the base URL before `/testnet`) or `VITE_ALEO_PROGRAM_ID` in `frontend/.env.local` and restart Vite. Shared links refer to the ledger configured for the frontend that opens them.

## Verify

```sh
(cd contracts && leo test --network testnet)
(cd frontend && npm run build)
```

### Before a public testnet deployment

Run from the repository root with Python 3, Leo 4.4.6, and npm available. Both contract suites live in `contracts/tests/`. Leo runs the `.leo` test, and Python runs the two-player devnode test.

```sh
(cd contracts && leo test --prove --network testnet)
python3 contracts/tests/test_devnode.py
(cd contracts && leo synthesize mastermind.aleo --local --network testnet --endpoint https://api.explorer.provable.com/v1)
```

The integration suite starts a temporary devnode and deploys the contract with a real certificate. It checks a proof-backed create, guess, and feedback, secret handling, rejected moves, scoring with repeated colors, a win, a ten-round loss, and index cleanup for both players. The remaining moves use the devnode’s fast execution mode.

For public deployment, configure a funded testnet account in the git-ignored `contracts/.env` using `PRIVATE_KEY`. Any funded account can deploy edition 0. The constructor fixes the upgrade authority at `aleo1s04xz7v48t8jyf5kyzv5f080ctm3wfcrv0ezk2u0l863q79neuxsv2yg9n`. Check the program ID, authority, and fee in the dry run before broadcasting.

```sh
cd contracts
unset DEVNET CONSENSUS_VERSION_HEIGHTS
leo deploy --network testnet --endpoint https://api.explorer.provable.com/v1
leo deploy --network testnet --endpoint https://api.explorer.provable.com/v1 --broadcast
```

To publish a later edition, configure the upgrade authority’s signing key and run the following command from `contracts/`.

```sh
leo upgrade --network testnet --endpoint https://api.explorer.provable.com/v1 --broadcast
```
