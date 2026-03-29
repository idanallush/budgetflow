import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

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
    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'campaigner' CHECK (role IN ('admin', 'campaigner')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        share_token TEXT UNIQUE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug)`
    await sql`CREATE INDEX IF NOT EXISTS idx_clients_share_token ON clients(share_token)`

    await sql`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        technical_name TEXT,
        platform TEXT NOT NULL CHECK (platform IN ('facebook', 'google')),
        campaign_type TEXT,
        ad_link TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
        start_date DATE NOT NULL,
        end_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform)`
    await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`

    await sql`
      CREATE TABLE IF NOT EXISTS budget_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        daily_budget NUMERIC NOT NULL CHECK (daily_budget >= 0),
        start_date DATE NOT NULL,
        end_date DATE,
        created_by UUID REFERENCES team_members(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_budget_periods_campaign_id ON budget_periods(campaign_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_budget_periods_dates ON budget_periods(start_date, end_date)`

    await sql`
      CREATE TABLE IF NOT EXISTS changelog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('budget_change', 'status_change', 'campaign_added', 'campaign_removed', 'note_added')),
        description TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        performed_by TEXT NOT NULL DEFAULT 'מערכת',
        performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_changelog_campaign_id ON changelog(campaign_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_changelog_performed_at ON changelog(performed_at DESC)`

    // Insert default admin user
    const passwordHash = await bcrypt.hash('admin123', 12)

    await sql`
      INSERT INTO team_members (name, email, password_hash, role)
      VALUES ('עידן', 'idan@bright.co.il', ${passwordHash}, 'admin')
      ON CONFLICT (email) DO NOTHING
    `

    return res.status(200).json({
      success: true,
      message: 'Migration completed. Default admin: idan@bright.co.il / admin123',
    })
  } catch (err) {
    console.error('Migration error:', err)
    return res.status(500).json({ error: 'Migration failed', details: String(err) })
  }
}
