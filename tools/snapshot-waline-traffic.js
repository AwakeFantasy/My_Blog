#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SITE_PV_PATH = '/__waline_site_pv__';
const SITE_UV_PATH = '/__waline_site_uv__';
const DEFAULT_DATA_FILE = path.join(__dirname, '..', 'data', 'site-traffic.json');
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const help = args.includes('--help') || args.includes('-h');
const dataFile = path.resolve(getArgValue('--data') || DEFAULT_DATA_FILE);
const snapshotDate = getArgValue('--date') || todayInShanghai();

function getArgValue(name) {
  const prefix = `${name}=`;
  const arg = args.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function printHelp() {
  console.log(`
Usage:
  node tools/snapshot-waline-traffic.js [options]

Options:
  --date=YYYY-MM-DD       Snapshot date. Defaults to today's date in Asia/Shanghai.
  --data=PATH             JSON data file. Defaults to data/site-traffic.json.
  --dry-run               Print the snapshot without writing the JSON file.
  -h, --help              Show this help.

Environment:
  DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL must point to the Waline PostgreSQL database.
`);
}

async function listPublicTables(client) {
  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  return rows.map(row => row.table_name);
}

async function tableColumns(client, table) {
  const { rows } = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position
    `,
    [table]
  );
  return new Set(rows.map(row => row.column_name));
}

async function resolveCounterTable(client) {
  const tables = await listPublicTables(client);
  return ['counter', 'wl_counter', 'Counter'].find(table => tables.includes(table));
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function readCounter(client, counterTable, columns, url) {
  const table = quoteIdent(counterTable);
  const urlColumn = columns.has('url') ? 'url' : columns.has('path') ? 'path' : null;
  const valueColumn = columns.has('time') ? 'time' : columns.has('count') ? 'count' : null;

  if (!urlColumn || !valueColumn) {
    throw new Error(`Waline counter table ${counterTable} must contain url/time or path/count columns.`);
  }

  const { rows } = await client.query(
    `select ${quoteIdent(valueColumn)} as value from ${table} where ${quoteIdent(urlColumn)} = $1`,
    [url]
  );

  return rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
}

function readTrafficData(file) {
  if (!fs.existsSync(file)) return [];

  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];

  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`${file} must contain a JSON array.`);
  }

  return data;
}

function upsertSnapshot(data, snapshot) {
  const next = data.filter(item => item.date !== snapshot.date);
  next.push(snapshot);
  next.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return next;
}

function writeTrafficData(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  if (help) {
    printHelp();
    return;
  }

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL. Set DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL.');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const counterTable = await resolveCounterTable(client);
    if (!counterTable) {
      const tables = await listPublicTables(client);
      throw new Error(`Waline counter table was not found. Public tables: ${tables.join(', ') || '(none)'}`);
    }

    const columns = await tableColumns(client, counterTable);
    const pv = await readCounter(client, counterTable, columns, SITE_PV_PATH);
    const uv = await readCounter(client, counterTable, columns, SITE_UV_PATH);
    const snapshot = {
      date: snapshotDate,
      pv,
      uv,
      source: 'waline',
      capturedAt: new Date().toISOString()
    };

    const current = readTrafficData(dataFile);
    const next = upsertSnapshot(current, snapshot);

    console.log(JSON.stringify({
      dryRun,
      dataFile,
      counterTable,
      snapshot
    }, null, 2));

    if (!dryRun) {
      writeTrafficData(dataFile, next);
      console.log(`Updated ${path.relative(process.cwd(), dataFile)}`);
    }
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
