import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const secret = req.headers['x-migrate-secret']
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Invalid migration secret' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not set' })
  }

  const sql = neon(databaseUrl)

  try {
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS meta_ad_account_id text DEFAULT NULL`
    await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_campaign_id text DEFAULT NULL`
    await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS actual_spend numeric DEFAULT 0`
    await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT NULL`
    await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_meta_campaign_id ON campaigns(meta_campaign_id)`

    return res.status(200).json({
      success: true,
      message: 'Meta API migration completed — added meta_ad_account_id, meta_campaign_id, actual_spend, last_synced_at',
    })
  } catch (err) {
    console.error('Migration error:', err)
    return res.status(500).json({ error: 'Migration failed', details: String(err) })
  }
}
