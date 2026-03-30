import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required' })
  }
  const jwt = await import('jsonwebtoken')
  try {
    const secret = process.env.JWT_SECRET || 'budgetflow-dev-secret-change-me'
    jwt.default.verify(authHeader.slice(7), secret)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not set' })
  }

  const sql = neon(databaseUrl)

  try {
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_customer_id text DEFAULT NULL`

    return res.status(200).json({
      success: true,
      message: 'Google Ads migration completed — added google_customer_id to clients',
    })
  } catch (err) {
    console.error('Migration error:', err)
    return res.status(500).json({ error: 'Migration failed', details: String(err) })
  }
}
