# FundFlow: Real-Time Decentralized Crowdfunding

FundFlow is a Web3 crowdfunding DApp. Approved creators launch campaigns, anyone can contribute ETH, and the smart contract enforces the rules: a campaign can never raise more than its goal, contributors can withdraw before the deadline, and failed campaigns are refunded.

- **Live app:** TODO https://fundflow-xxxx.vercel.app
- **Network:** Sepolia testnet
- **Contract:** [`0x578A2bd5b7606FaEFD847C6C24b0E34C9bdd5B4C`](https://sepolia.etherscan.io/address/0x578A2bd5b7606FaEFD847C6C24b0E34C9bdd5B4C#code) (verified)
- **Demo video:** TODO link or filename

![Home](docs/screenshots/home.png)

## Features

**Smart contract (all mandatory requirements)**

| Requirement | Implementation |
|---|---|
| A. Funding percentage | `getFundingPercentage(id)` returns basis points (10000 = 100.00%) |
| B. Withdraw before deadline | `withdrawContribution(id)` returns the caller's full contribution while the campaign is Active |
| C. Exact funding goal | `fundProject(id)` accepts only the remaining amount and refunds the excess to the sender |
| D. Admin and creators | `admin` set in the constructor, `addCreator` / `removeCreator` / `isCreator`, `createProject` is creator-only |
| E. Total projects | `totalProjectsCreated` |
| F. Success and failure tracking | `totalSuccessfulProjects`, `totalFailedProjects`, `finalizeProject(id)` |

Two functions go beyond the brief because the app can't work without them: `claimFunds` (creator collects a funded campaign) and `claimRefund` (contributors recover money from a failed campaign).

**Frontend**
- Wallet connection, account detection and wrong-network warning
- Campaign list and detail pages with live progress (polling every 10 s)
- Status badges: Active, Funded, Expired, Failed
- Fund form with a live preview of the exact-goal refund
- Creator dashboard, contributor dashboard, admin panel
- Transaction toasts with readable messages for every contract error
- Responsive layout

## Architecture

```
Wallet (MetaMask) <-> Next.js (wagmi + viem) <-> RPC (Sepolia) <-> FundFlow.sol
```

```
fundflow/
├── contracts/            Foundry project
│   ├── src/FundFlow.sol  the only contract
│   ├── test/             unit, fuzz, invariant and reentrancy tests
│   └── script/           deploy script
├── frontend/             Next.js app
└── docs/screenshots/
```

There is no backend. The blockchain is the database, and the frontend reads it directly.

### Campaign lifecycle

```
Active ──(raised == goal)──────────────> Funded ──(creator) claimFunds
   │
   └──(deadline passed, raised < goal, anyone calls finalizeProject)──> Failed ──(contributors) claimRefund
```

A project can only leave `Active` once, so each project is counted exactly once as a success or a failure. Blockchains cannot run code on a timer, so failure is recorded when anyone calls `finalizeProject` after the deadline. Until then the UI shows the campaign as **Expired**.

## Smart contract reference

| Function | Who | Description |
|---|---|---|
| `createProject(title, description, goal, deadline)` | Approved creators | Creates a campaign. Goal is in wei, deadline is a unix timestamp in the future |
| `fundProject(id)` payable | Anyone | Contributes ETH. Never exceeds the goal, any excess is refunded immediately |
| `withdrawContribution(id)` | Contributor | Takes back the full contribution before the deadline |
| `finalizeProject(id)` | Anyone | After the deadline, marks an unfunded project Failed and increments the failed counter |
| `claimRefund(id)` | Contributor | Recovers the contribution from a Failed project |
| `claimFunds(id)` | Project creator | Collects the ETH of a Funded project, once |
| `getFundingPercentage(id)` view | Anyone | Raised / goal in basis points |
| `getProject(id)` view | Anyone | Returns the project struct |
| `addCreator(a)` / `removeCreator(a)` | Admin | Manage approved creators |
| `isCreator(a)` view | Anyone | Whether an address is an approved creator |
| `getSuccessfulProjectsCount()` / `getFailedProjectsCount()` view | Anyone | Outcome counters |

## Security

- Checks-Effects-Interactions: state is updated before any ETH is sent
- A `nonReentrant` guard on every function that sends ETH
- Role checks (`onlyAdmin`, `onlyCreator`, creator-only claim)
- Input validation (empty title, zero goal, past deadline, zero-value funding)
- ETH sent with a low-level `call` and a checked result
- Solidity 0.8 checked arithmetic

**Testing (Foundry):** unit tests for every requirement, fuzz tests (no overfunding, percentage formula, withdraw-before-deadline), four invariants (raised never exceeds goal, funded means exactly the goal, counters match statuses, contract balance equals what it owes), and an attacker contract that tries to re-enter `withdrawContribution` and `fundProject`.

**Known limitations**
1. A single admin with no ownership transfer.
2. Failure needs someone to send a `finalizeProject` transaction.
3. Removing a creator does not cancel their existing campaigns.
4. Withdrawal is all-or-nothing.
5. The contract is unaudited and meant for testnet use.

## Technology stack

Solidity 0.8.24, Foundry (forge, anvil, cast), Next.js, React, TypeScript, Tailwind CSS, wagmi, viem, TanStack Query, Sepolia, Vercel.

## Local setup

**Prerequisites:** Git, Node 20+, Foundry (`curl -L https://foundry.paradigm.xyz | bash`, then `foundryup`), MetaMask.

```bash
git clone https://github.com/TODO_USERNAME/fundflow.git
cd fundflow
```

**1. Contracts**
```bash
cd contracts
forge build
forge test
```

**2. Local chain and deployment** (separate terminal for Anvil)
```bash
anvil
```
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <ANVIL_ACCOUNT_0_KEY>
```
Anvil's account 0 key is printed by `anvil` and is public. Never use it on a real network.

**3. Frontend**
```bash
cd frontend
npm install
```
Edit `src/lib/contract.ts`: set `CONTRACT_ADDRESS` to your deployed address, and `TARGET_CHAIN` to `foundry` for Anvil or `sepolia` for the testnet.
```bash
npm run dev
```
Open http://localhost:3000.

If you change the contract, regenerate the ABI from `contracts/`:
```bash
echo "export const fundFlowAbi = $(jq -c '.abi' out/FundFlow.sol/FundFlow.json) as const;" > ../frontend/src/lib/abi.ts
```

## Deploying

**Contract (Sepolia):** use a Foundry keystore (`cast wallet import deployer --interactive`), then:
```bash
forge create src/FundFlow.sol:FundFlow --rpc-url $SEPOLIA_RPC_URL --account deployer --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```
The deployer becomes the admin. Call `addCreator` to approve creators.

**Frontend (Vercel):** import the repo, set the Root Directory to `frontend`, and add the environment variable `NEXT_PUBLIC_SEPOLIA_RPC` (an RPC URL only).

## Screenshots

| | |
|---|---|
| ![Detail](docs/screenshots/project.png) | ![Overfund preview](docs/screenshots/overfund-preview.png) |
| ![Create](docs/screenshots/create.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| ![Admin](docs/screenshots/admin.png) | ![Tests](docs/screenshots/tests.png) |

## License

MIT