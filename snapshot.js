const https = require('https');
const fs = require('fs');


const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const STEP = 500;

// Args
let RPC_URL = undefined;
let START_BLOCK = undefined;
let END_BLOCK = undefined;
let proposalId = undefined;
let TOKEN_ADDRESS = undefined;

let rpcId = 1;
let requestCounter = 0;

const query = (voterAddress, proposalSpace) => `
  query {
    vp (
      voter: "${voterAddress}"
      proposal: "${proposalId}"
      space: "${proposalSpace}"
    ) {
      vp
      vp_by_strategy
      vp_state
    } 
  }
`;

const url = 'https://hub.snapshot.org/graphql';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hex(n) {
  return '0x' + n.toString(16);
}

function hexToBigInt(hex) {
  return BigInt(hex);
}

function parseLog(log) {
  const from = '0x' + log.topics[1].slice(26).toLowerCase();
  const to = '0x' + log.topics[2].slice(26).toLowerCase();
  const value = hexToBigInt(log.data);
  return { from, to, value };
}

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    requestCounter++;
    if (requestCounter % 3 === 0) {
      // wait 1s every 3 requests
      console.log('⏳ Waiting 1 second to avoid rate limiting...');
      sleep(1000).then(() => doRpcCall(method, params, resolve, reject));
    } else {
      doRpcCall(method, params, resolve, reject);
    }
  });
}

function doRpcCall(method, params, resolve, reject) {
  const data = JSON.stringify({
    jsonrpc: '2.0',
    id: rpcId++,
    method,
    params
  });

  const url = new URL(RPC_URL);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.error) return reject(json.error);
        resolve(json.result);
      } catch (err) {
        reject(err);
      }
    });
  });

  req.on('error', reject);
  req.write(data);
  req.end();
}

async function getLogs(fromBlock, toBlock) {
  return rpcCall('eth_getLogs', [{
    fromBlock: hex(fromBlock),
    toBlock: hex(toBlock),
    address: TOKEN_ADDRESS,
    topics: [TRANSFER_TOPIC]
  }]);
}

async function snapshot() {
  const balances = {};

  for (let block = START_BLOCK; block <= END_BLOCK; block += STEP) {
    const from = block;
    const to = Math.min(block + STEP - 1, END_BLOCK);

    console.log(`📦 Fetching logs from block ${from} to ${to}...`);
    let logs;
    try {
      logs = await getLogs(from, to);
    } catch (e) {
      console.error(`❌ Error at block ${from}-${to}: ${e.message}`);
      continue;
    }

    console.log(` → ${logs.length} logs`);

    for (const log of logs) {
      const { from, to, value } = parseLog(log);

      if (from !== '0x0000000000000000000000000000000000000000') {
        balances[from] = (balances[from] || 0n) - value;
      }
      if (to !== '0x0000000000000000000000000000000000000000') {
        balances[to] = (balances[to] || 0n) + value;
      }
    }
  }

  console.log(`✅ Found ${entries.length} holders`);
  fs.writeFileSync('addresses.json', Object.keys(entries), { encoding: 'utf-8' });

  const holders = Object.entries(balances)
    .filter(([_, bal]) => bal > 0n)
    .sort((a, b) => Number(BigInt(b[1]) - BigInt(a[1])));

  fs.writeFileSync('snapshot.csv', 'address,balance\n' + holders.map(([a, b]) => `${a},${b}`).join('\n'), { encoding: 'utf-8' });
  console.log(`📄 Snapshot saved to snapshot.csv and addresses.json`);
}

async function getProposalSpace() {
  const queryProposal = `
    query {
      proposal(id:"${proposalId}") {
        space {
          id
          name
        }
      }
    }
  `

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryProposal })
  });

  const json = await response.json();
  return json.data.proposal.space.id;
}

async function fetchVP() {
  try {
    const proposalSpace = await getProposalSpace();
    const addresses = JSON.parse(fs.readFileSync("addresses.json", { encoding: 'utf-8' }));

    console.log(
      `✅ Fetching voting power\n` +
      `🔢 For ${addresses.length} holders\n` +
      `📜 Proposal: ${proposalId}\n` +
      `🌐 Space: ${proposalSpace}`
    );

    const vps = {};

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const q = query(address, proposalSpace);

      let json = await sendQuery(q);

      // Retry if response is invalid
      if (!json?.data) {
        console.warn(`⚠️ No data for ${address}, retrying in 15s...`);
        await sleep(15000);
        json = await sendQuery(q);
      }

      // Fallback if still undefined
      if (!json?.data) {
        console.error(`❌ Failed to fetch voting power for ${address}`);
        vps[address.toLowerCase()] = 0;
      } else {
        vps[address.toLowerCase()] = json.data?.vp?.vp || 0;
      }

      // Sleep every 3 requests
      if ((i + 1) % 3 === 0) {
        await sleep(5000);
      }
    }

    const sortedEntries = Object.entries(vps).sort(([, a], [, b]) => b - a);
    const sortedVps = Object.fromEntries(sortedEntries);

    fs.writeFileSync('vps.json', JSON.stringify(sortedVps, null, 2), { encoding: 'utf-8' });

  } catch (err) {
    console.error('Erreur lors de la requête GraphQL :', err);
  }
}

async function sendQuery(query) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return await response.json();
  } catch (e) {
    console.error('❌ Network or parsing error:', e);
    return null;
  }
}

async function main() {
  [proposalId, RPC_URL, start, end, TOKEN_ADDRESS] = process.argv.slice(2);
  START_BLOCK = parseInt(start, 10);
  END_BLOCK = parseInt(end, 10);

  const missing = [];
  if (!proposalId) missing.push("proposal id");
  if (!RPC_URL) missing.push("rpc url");
  if (!START_BLOCK) missing.push("start block");
  if (!END_BLOCK) missing.push("end block");
  if (!TOKEN_ADDRESS) missing.push("token address");

  if (missing.length) {
    console.error(`❌ Missing required argument(s): ${missing.join(", ")}`);
    console.log(`\n👉 Usage: node snapshot.js <proposalId> <rpcUrl> <startBlock> <endBlock>\n`);
    process.exit(1);
  }

  await snapshot();
  await fetchVP();
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
});