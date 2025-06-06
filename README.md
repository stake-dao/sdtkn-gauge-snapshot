# 🗳 Snapshot + Voting Power Fetcher

A Node.js script that:

1. 📦 Takes an **on-chain snapshot** of ERC-20 token holders based on `Transfer` logs.
2. 🗳 Fetches their **voting power** for a specific proposal on [Snapshot.org](https://snapshot.org).

---

## 🚀 Features

- 🔍 Scans the blockchain between two block numbers using your own RPC node.
- 🧮 Calculates token balances from raw `Transfer` logs.
- 📂 Exports:
  - `addresses.json`: All token holders with non-zero balance.
  - `snapshot.csv`: On-chain balances per holder.
  - `vps.json`: Voting power (off-chain) per holder, sorted descending.
- 🔁 Automatically retries GraphQL queries if Snapshot returns no data.
- 🛡️ Handles rate limiting with sleep intervals.

---

## 🧰 Requirements

- Node.js v18+ (for built-in `fetch`)
- A working Ethereum RPC URL (e.g., Ankr, Alchemy, Infura, local Geth node)

---

## 📦 Usage

```bash
node snapshot.js <proposalId> <rpcUrl> <startBlock> <endBlock> <tokenAddress>