import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const { Client } = pg

function loadEnvFile(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

try {
  const envText = await readFile(resolve('.env'), 'utf8')
  loadEnvFile(envText)
} catch {
  // .env is optional; CI can provide env vars directly.
}

const connectionString = process.env.SUPABASE_DB_URL

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL. Add it to .env or export it before running npm run db:push.')
  process.exit(1)
}

try {
  const parsed = new URL(connectionString)
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol "${parsed.protocol}"`)
  }
} catch (error) {
  console.error('Invalid SUPABASE_DB_URL. It must be a PostgreSQL connection string.')
  console.error('Example: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres')
  console.error('If your database password contains special characters like @, #, %, /, or :, URL-encode them first.')
  process.exit(1)
}

const schemaPath = resolve('supabase-schema.sql')
const sql = await readFile(schemaPath, 'utf8')
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log('Supabase schema applied successfully.')
} finally {
  await client.end()
}
