# 🗳 Snapshot + Voting Power Fetcher

This Node.js script performs two main tasks:

1. 📦 Creates an **on-chain snapshot** of holders for a given ERC-20 token.
2. 🗳 Retrieves the **voting power** of each holder for a specific Snapshot proposal.

---

## 🚀 Features

- 🔍 Scans the blockchain between two block numbers (`START_BLOCK` ➜ `END_BLOCK`) using a provided RPC URL.
- 🧾 Extracts balances from `Transfer` logs of a specific token contract.
- 🗂 Outputs the holders into:
  - `addresses.json` (list of holders)
  - `snapshot.csv` (address + raw on-chain balance)
- 🌐 Queries [Snapshot.org](https://snapshot.org) GraphQL API to fetch the voting power (`vp`) for each address.
- 🔁 Handles rate limits with automatic sleep and retries on error.

---

## 📦 Requirements

- Node.js 18+ (for built-in `fetch`)
- A public or private Ethereum RPC endpoint

---

## 🧑‍💻 Usage

```bash
node snapshot.js <proposalId> <rpcUrl> <startBlock> <endBlock>