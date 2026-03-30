import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, History, Copy, Pencil, Check, X, Wallet, Trash2, RefreshCw } from 'lucide-react'
import { useClient, useDeleteClient } from '@/hooks/useClients'
import { useCampaigns, useUpdateCampaignStatus, useDeleteCampaign, useMetaSync, useGoogleSync } from '@/hooks/useCampaigns'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Button } from '@/components/ui/Button'
import { MetricCard } from '@/components/ui/MetricCard'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { CampaignTable, NoCampaignsState } from '@/components/CampaignTable'
import { CampaignModal } from '@/components/CampaignModal'
import { BudgetEditDialog } from '@/components/BudgetEditDialog'
import { EndDateEditDialog } from '@/components/EndDateEditDialog'
import { ChangelogPanel } from '@/components/ChangelogPanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDateTime, todayISO, getDaysInMonth } from '@/lib/format'
import type { CampaignWithBudget, CampaignStatus } from '@/types'

const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const getMonthlyBudgetKey = (clientId: string) => {
  const now = new Date()
  return `bf_monthly_budget_${clientId}_${now.getFullYear()}_${now.getMonth()}`
}

export const ClientView = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: client, isLoading: clientLoading } = useClient(slug ?? '')
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(client?.id ?? '')
  const updateStatus = useUpdateCampaignStatus()
  const deleteCampaign = useDeleteCampaign()
  const deleteClient = useDeleteClient()
  const metaSync = useMetaSync()
  const googleSync = useGoogleSync()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithBudget | null>(null)
  const [budgetEditCampaign, setBudgetEditCampaign] = useState<CampaignWithBudget | null>(null)
  const [changelogCampaignId, setChangelogCampaignId] = useState<string | null>(null)
  const [showClientChangelog, setShowClientChangelog] = useState(false)
  const [endDateCampaign, setEndDateCampaign] = useState<CampaignWithBudget | null>(null)
  const [deletingCampaign, setDeletingCampaign] = useState<CampaignWithBudget | null>(null)
  const [showDeleteClient, setShowDeleteClient] = useState(false)

  // Monthly budget goal (persisted in localStorage per client+month)
  const [monthlyBudgetGoal, setMonthlyBudgetGoal] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    if (!client) return
    const saved = localStorage.getItem(getMonthlyBudgetKey(client.id))
    setMonthlyBudgetGoal(saved ? Number(saved) : null)
  }, [client])

  const saveGoal = () => {
    if (!client || !goalInput) return
    const val = Number(goalInput)
    if (val <= 0) return
    localStorage.setItem(getMonthlyBudgetKey(client.id), String(val))
    setMonthlyBudgetGoal(val)
    setEditingGoal(false)
    setGoalInput('')
    toast.success('תקציב חודשי נשמר')
  }

  const isLoading = clientLoading || campaignsLoading

  const totalDaily = campaigns?.reduce((sum, c) => sum + c.current_daily_budget, 0) ?? 0
  const totalForecast = campaigns?.reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const fbForecast = campaigns?.filter((c) => c.platform === 'facebook')
    .reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const googleForecast = campaigns?.filter((c) => c.platform === 'google')
    .reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const now = new Date()
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth())
  const daysPassed = now.getDate()
  const daysRemaining = daysInMonth - daysPassed
  const monthProgress = Math.round((daysPassed / daysInMonth) * 100)
  const monthStr = String(now.getMonth() + 1).padStart(2, '0')
  const yearStr = String(now.getFullYear()).slice(2)
  const dateRangeText = `01.${monthStr}.${yearStr} — ${daysInMonth}.${monthStr}.${yearStr}`

  const totalActualSpend = campaigns?.reduce((sum, c) => sum + (Number(c.actual_spend) || 0), 0) ?? 0
  const lastSyncedCampaign = campaigns
    ?.filter((c) => c.last_synced_at)
    .sort((a, b) => new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime())[0]

  const hasCampaigns = campaigns && campaigns.length > 0
  const hasFb = campaigns?.some((c) => c.platform === 'facebook')
  const hasGoogle = campaigns?.some((c) => c.platform === 'google')

  const handleStatusChange = async (campaignId: string, status: CampaignStatus) => {
    if (!client) return
    try {
      await updateStatus.mutateAsync({
        campaign_id: campaignId,
        client_id: client.id,
        status,
        end_date: status === 'stopped' ? todayISO() : undefined,
      })
      const labels: Record<CampaignStatus, string> = { active: 'פעיל', paused: 'מושהה', stopped: 'הופסק' }
      toast.success(`סטטוס שונה ל${labels[status]}`)
    } catch {
      toast.error('שגיאה בשינוי סטטוס')
    }
  }

  const copyShareLink = () => {
    if (!client) return
    const url = `${window.location.origin}/share/${client.share_token}`
    navigator.clipboard.writeText(url)
    toast.success('קישור שיתוף הועתק')
  }

  const handleDeleteCampaign = async () => {
    if (!deletingCampaign || !client) return
    try {
      await deleteCampaign.mutateAsync({ campaign_id: deletingCampaign.id, client_id: client.id })
      toast.success(`הקמפיין "${deletingCampaign.name}" נמחק`)
      setDeletingCampaign(null)
    } catch {
      toast.error('שגיאה במחיקת קמפיין')
    }
  }

  const handleDeleteClient = async () => {
    if (!client) return
    try {
      await deleteClient.mutateAsync(client.slug)
      toast.success(`הלקוח "${client.name}" נמחק`)
      navigate('/')
    } catch {
      toast.error('שגיאה במחיקת לקוח')
    }
  }

  const handleSync = async () => {
    if (!client) return
    let adAccountId = client.meta_ad_account_id
    if (!adAccountId) {
      const input = prompt('הזן Meta Ad Account ID (למשל: act_123456789):')
      if (!input) return
      adAccountId = input
    }
    try {
      const result = await metaSync.mutateAsync({
        client_id: client.id,
        ad_account_id: adAccountId || undefined,
      })
      toast.success(`סונכרנו ${result.created} חדשים, ${result.updated} עודכנו`)
    } catch (err) {
      toast.error(`שגיאת סנכרון: ${(err as Error).message}`)
    }
  }

  const handleGoogleSync = async () => {
    if (!client) return

    let customerId = client.google_customer_id
    let mccId = client.google_mcc_id

    if (!customerId) {
      const input = prompt('הזן Google Ads Customer ID (10 ספרות, בלי מקפים):')
      if (!input) return
      customerId = input.replace(/-/g, '')
    }

    if (!mccId) {
      const input = prompt('הזן Google MCC ID (10 ספרות, בלי מקפים):')
      if (!input) return
      mccId = input.replace(/-/g, '')
    }

    try {
      const result = await googleSync.mutateAsync({
        client_id: client.id,
        google_customer_id: customerId || undefined,
        google_mcc_id: mccId || undefined,
      })
      toast.success(`Google: ${result.created} חדשים, ${result.updated} עודכנו`)
    } catch (err) {
      toast.error(`שגיאת Google: ${(err as Error).message}`)
    }
  }

  if (!isLoading && !client) {
    return (
      <GlassPanel className="p-8 text-center">
        <p className="text-lg text-text-secondary">לקוח לא נמצא</p>
        <Link to="/" className="btn-ghost inline-flex mt-4">חזרה לדשבורד</Link>
      </GlassPanel>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn-icon">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">
              {client?.name ?? '...'}
            </h1>
            {client?.notes && (
              <p className="text-sm text-text-secondary mt-1">{client.notes}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hover:!text-danger hover:!border-danger/30" onClick={() => setShowDeleteClient(true)}>
            <Trash2 size={16} />
            מחק לקוח
          </Button>
          <Button variant="ghost" onClick={() => setShowClientChangelog(true)}>
            <History size={16} />
            היסטוריית שינויים
          </Button>
          <Button variant="ghost" onClick={copyShareLink}>
            <Copy size={16} />
            קישור שיתוף
          </Button>
          <Button variant="ghost" onClick={handleSync} disabled={metaSync.isPending}>
            <RefreshCw size={16} className={metaSync.isPending ? 'animate-spin' : ''} />
            {metaSync.isPending ? 'מסנכרן...' : 'סנכרן Meta'}
          </Button>
          <Button variant="ghost" onClick={handleGoogleSync} disabled={googleSync.isPending}>
            <RefreshCw size={16} className={googleSync.isPending ? 'animate-spin' : ''} />
            {googleSync.isPending ? 'מסנכרן...' : 'סנכרן Google'}
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            הוסף קמפיין
          </Button>
        </div>
      </div>

      {/* Monthly budget goal */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs text-text-muted">
                תקציב לחודש {hebrewMonths[now.getMonth()]} {now.getFullYear()}
              </p>
              <span className="text-xs text-text-muted">({dateRangeText})</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${client?.meta_ad_account_id ? 'bg-success' : ''}`} style={!client?.meta_ad_account_id ? { background: 'rgba(255,255,255,0.2)' } : undefined} />
                <span className="text-xs text-text-muted">Meta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${client?.google_customer_id ? 'bg-success' : ''}`} style={!client?.google_customer_id ? { background: 'rgba(255,255,255,0.2)' } : undefined} />
                <span className="text-xs text-text-muted">Google</span>
              </div>
            </div>
            {editingGoal ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  className="glass-input !py-1.5 !px-3 !text-sm w-32"
                  type="number"
                  placeholder="₪50,000"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false) }}
                />
                <Button variant="icon" className="!w-7 !h-7" onClick={saveGoal}><Check size={14} className="text-success" /></Button>
                <Button variant="icon" className="!w-7 !h-7" onClick={() => setEditingGoal(false)}><X size={14} /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">
                  {monthlyBudgetGoal ? formatCurrency(monthlyBudgetGoal) : 'לא הוגדר'}
                </span>
                <button
                  className="btn-icon !w-7 !h-7"
                  onClick={() => { setGoalInput(monthlyBudgetGoal ? String(monthlyBudgetGoal) : ''); setEditingGoal(true) }}
                  title="עריכת תקציב חודשי"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Forecast vs goal comparison */}
        {monthlyBudgetGoal && hasCampaigns && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-end">
              <p className="text-xs text-text-muted">צפי מול יעד</p>
              <p className="font-semibold">
                {formatCurrency(totalForecast)} / {formatCurrency(monthlyBudgetGoal)}
              </p>
            </div>
            {totalActualSpend > 0 && (
              <div className="text-end">
                <p className="text-xs text-text-muted">הוצאה בפועל עד היום</p>
                <p className="font-semibold">{formatCurrency(totalActualSpend)}</p>
              </div>
            )}
            <div className="text-end">
              <p className="text-xs text-text-muted">פער</p>
              {(() => {
                const diff = totalForecast - monthlyBudgetGoal
                return (
                  <span className={`chip text-xs ${diff > 0 ? 'status-stopped' : diff < 0 ? 'status-active' : ''}`}>
                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                  </span>
                )
              })()}
            </div>
          </div>
        )}

        {/* Days info row */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0 0' }} />
        <div className="flex items-center gap-4 pt-4 flex-wrap">
          {/* Mini progress ring */}
          <div className="shrink-0" style={{ width: 48, height: 48 }}>
            <svg viewBox="0 0 48 48" style={{ width: '100%', height: '100%' }}>
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(daysPassed / daysInMonth) * 125.6} 125.6`}
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
              <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
                fill="rgba(255,255,255,0.9)" fontSize="13" fontWeight="600" fontFamily="var(--font-sans)">
                {daysPassed}
              </text>
            </svg>
          </div>

          {/* Day metrics */}
          <div className="flex items-center gap-6 flex-1">
            <div className="text-center">
              <p className="text-xs text-text-muted mb-1">ימים בחודש</p>
              <p className="text-lg font-semibold">{daysInMonth}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted mb-1">ימים שעברו</p>
              <p className="text-lg font-semibold text-accent">{daysPassed}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted mb-1">ימים שנשארו</p>
              <p className="text-lg font-semibold">{daysRemaining}</p>
            </div>
          </div>

          {/* Linear progress bar */}
          <div className="flex-1 max-w-[200px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">התקדמות החודש</span>
              <span className="text-xs font-semibold">{monthProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${monthProgress}%`,
                  background: 'var(--color-accent)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Last sync indicator */}
        {lastSyncedCampaign && (
          <div className="flex items-center justify-end pt-2">
            <span className="text-xs text-text-muted">
              סנכרון Meta אחרון: {formatDateTime(lastSyncedCampaign.last_synced_at!)}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      {hasCampaigns && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="תקציב יומי" value={formatCurrency(totalDaily)} />
          <MetricCard label="צפי חודשי" value={formatCurrency(totalForecast)} />
          <MetricCard label="Meta" value={formatCurrency(fbForecast)} />
          <MetricCard label="Google" value={formatCurrency(googleForecast)} />
        </div>
      )}

      {/* Campaign Tables */}
      <GlassPanel className="p-6">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !hasCampaigns ? (
          <NoCampaignsState onAdd={() => setShowAddModal(true)} />
        ) : (
          <>
            {hasFb && (
              <CampaignTable
                campaigns={campaigns}
                platform="facebook"
                onEditCampaign={setEditingCampaign}
                onViewChangelog={setChangelogCampaignId}
                onBudgetEdit={setBudgetEditCampaign}
                onStatusChange={handleStatusChange}
                onEndDateEdit={setEndDateCampaign}
                onDeleteCampaign={setDeletingCampaign}
              />
            )}

            {hasGoogle && (
              <CampaignTable
                campaigns={campaigns}
                platform="google"
                onEditCampaign={setEditingCampaign}
                onViewChangelog={setChangelogCampaignId}
                onBudgetEdit={setBudgetEditCampaign}
                onStatusChange={handleStatusChange}
                onEndDateEdit={setEndDateCampaign}
                onDeleteCampaign={setDeletingCampaign}
              />
            )}

            {/* Grand Total (only if both platforms exist) */}
            {hasFb && hasGoogle && (
              <div className="glass-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <span className="font-semibold text-lg">סה״כ כללי</span>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-end">
                      <p className="text-xs text-text-muted">יומי</p>
                      <p className="font-semibold">{formatCurrency(totalDaily)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-text-muted">צפי חודשי</p>
                      <p className="text-xl font-semibold text-accent">{formatCurrency(totalForecast)}</p>
                    </div>
                    {totalActualSpend > 0 && (
                      <div className="text-end">
                        <p className="text-xs text-text-muted">הוצאה בפועל</p>
                        <p className="font-semibold">{formatCurrency(totalActualSpend)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </GlassPanel>

      {/* Modals & Panels */}
      <CampaignModal
        open={showAddModal || !!editingCampaign}
        onClose={() => {
          setShowAddModal(false)
          setEditingCampaign(null)
        }}
        clientId={client?.id ?? ''}
        campaign={editingCampaign}
      />

      <BudgetEditDialog
        open={!!budgetEditCampaign}
        onClose={() => setBudgetEditCampaign(null)}
        campaign={budgetEditCampaign}
        clientId={client?.id ?? ''}
      />

      <EndDateEditDialog
        open={!!endDateCampaign}
        onClose={() => setEndDateCampaign(null)}
        campaign={endDateCampaign}
        clientId={client?.id ?? ''}
      />

      <ChangelogPanel
        open={!!changelogCampaignId || showClientChangelog}
        onClose={() => {
          setChangelogCampaignId(null)
          setShowClientChangelog(false)
        }}
        campaignId={changelogCampaignId ?? undefined}
        clientId={showClientChangelog ? client?.id : undefined}
        title={showClientChangelog ? `היסטוריית שינויים — ${client?.name}` : undefined}
      />

      {/* Delete confirmations */}
      <ConfirmDialog
        open={!!deletingCampaign}
        onClose={() => setDeletingCampaign(null)}
        onConfirm={handleDeleteCampaign}
        title="מחיקת קמפיין"
        message={`האם למחוק את הקמפיין "${deletingCampaign?.name}"? כל היסטוריית התקציבים והשינויים תימחק לצמיתות.`}
        isPending={deleteCampaign.isPending}
      />

      <ConfirmDialog
        open={showDeleteClient}
        onClose={() => setShowDeleteClient(false)}
        onConfirm={handleDeleteClient}
        title="מחיקת לקוח"
        message={`האם למחוק את הלקוח "${client?.name}"? כל הקמפיינים, התקציבים וההיסטוריה יימחקו לצמיתות. פעולה זו בלתי הפיכה.`}
        isPending={deleteClient.isPending}
      />
    </div>
  )
}
