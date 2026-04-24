import { pgTable, uuid, text, boolean, numeric, date, timestamp, integer, index } from 'drizzle-orm/pg-core'

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull().default('campaigner'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  share_token: text('share_token').unique().notNull(),
  is_active: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  meta_ad_account_id: text('meta_ad_account_id'),
  google_customer_id: text('google_customer_id'),
  google_mcc_id: text('google_mcc_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_clients_slug').on(table.slug),
  index('idx_clients_share_token').on(table.share_token),
])

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  client_id: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  technical_name: text('technical_name'),
  platform: text('platform').notNull(),
  campaign_type: text('campaign_type'),
  ad_link: text('ad_link'),
  status: text('status').notNull().default('active'),
  start_date: date('start_date').notNull(),
  end_date: date('end_date'),
  notes: text('notes'),
  meta_campaign_id: text('meta_campaign_id'),
  actual_spend: numeric('actual_spend').default('0'),
  actual_spend_month: text('actual_spend_month'),
  last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_campaigns_client_id').on(table.client_id),
  index('idx_campaigns_platform').on(table.platform),
  index('idx_campaigns_status').on(table.status),
  index('idx_campaigns_meta_campaign_id').on(table.meta_campaign_id),
])

export const budgetPeriods = pgTable('budget_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign_id: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  daily_budget: numeric('daily_budget').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date'),
  created_by: uuid('created_by').references(() => teamMembers.id),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_budget_periods_campaign_id').on(table.campaign_id),
  index('idx_budget_periods_dates').on(table.start_date, table.end_date),
])

export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  client_id: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  status: text('status').notNull(),
  created_count: integer('created_count').notNull().default(0),
  updated_count: integer('updated_count').notNull().default(0),
  error: text('error'),
  duration_ms: integer('duration_ms'),
  triggered_by: text('triggered_by').notNull().default('manual'),
  synced_at: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sync_logs_client_id').on(table.client_id),
  index('idx_sync_logs_synced_at').on(table.synced_at),
])

export const changelog = pgTable('changelog', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign_id: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  description: text('description').notNull(),
  old_value: text('old_value'),
  new_value: text('new_value'),
  performed_by: text('performed_by').notNull().default('מערכת'),
  performed_at: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_changelog_campaign_id').on(table.campaign_id),
  index('idx_changelog_performed_at').on(table.performed_at),
])
