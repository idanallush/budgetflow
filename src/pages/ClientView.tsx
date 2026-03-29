import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, Plus, History, Copy, ToggleLeft, ToggleRight, Pencil, Check, X, Wallet } from 'lucide-react'
import { useClient } from '@/hooks/useClients'
import { useCampaigns, useUpdateCampaignStatus } from '@/hooks/useCampaigns'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Button } from '@/components/ui/Button'
import { MetricCard } from '@/components/ui/MetricCard'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { CampaignTable, NoCampaignsState } from '@/components/CampaignTable'
import { CampaignModal } from '@/components/CampaignModal'
import { BudgetEditDialog } from '@/components/BudgetEditDialog'
import { EndDateEditDialog } from '@/components/EndDateEditDialog'
import { ChangelogPanel } from '@/components/ChangelogPanel'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, todayISO } from '@/lib/format'
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
  const { data: client, isLoading: clientLoading } = useClient(slug ?? '')
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(client?.id ?? '')
  const updateStatus = useUpdateCampaignStatus()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithBudget | null>(null)
  const [budgetEditCampaign, setBudgetEditCampaign] = useState<CampaignWithBudget | null>(null)
  const [changelogCampaignId, setChangelogCampaignId] = useState<string | null>(null)
  const [showClientChangelog, setShowClientChangelog] = useState(false)
  const [showTechnicalName, setShowTechnicalName] = useState(false)
  const [endDateCampaign, setEndDateCampaign] = useState<CampaignWithBudget | null>(null)

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
  const totalOriginal = campaigns?.reduce((sum, c) => sum + c.original_plan, 0) ?? 0
  const totalVariance = totalForecast - totalOriginal
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
          <Button variant="ghost" onClick={() => setShowClientChangelog(true)}>
            <History size={16} />
            היסטוריית שינויים
          </Button>
          <Button variant="ghost" onClick={copyShareLink}>
            <Copy size={16} />
            קישור שיתוף
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
            <p className="text-xs text-text-muted">
              תקציב לחודש {hebrewMonths[new Date().getMonth()]} {new Date().getFullYear()}
            </p>
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
          <div className="flex items-center gap-4">
            <div className="text-end">
              <p className="text-xs text-text-muted">צפי מול יעד</p>
              <p className="font-semibold">
                {formatCurrency(totalForecast)} / {formatCurrency(monthlyBudgetGoal)}
              </p>
            </div>
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
        {/* Name toggle */}
        {hasCampaigns && (
          <div className="flex items-center justify-end mb-4">
            <button
              className="btn-ghost !rounded-[10px] !px-3 !py-1.5 text-xs flex items-center gap-2"
              onClick={() => setShowTechnicalName((v) => !v)}
            >
              {showTechnicalName ? <ToggleRight size={16} className="text-accent" /> : <ToggleLeft size={16} />}
              {showTechnicalName ? 'שם במערכת' : 'שם קמפיין'}
            </button>
          </div>
        )}
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
                showTechnicalName={showTechnicalName}
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
                showTechnicalName={showTechnicalName}
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
                    <div className="text-end">
                      <p className="text-xs text-text-muted">תוכנית מקורית</p>
                      <p className="font-semibold text-text-secondary">{formatCurrency(totalOriginal)}</p>
                    </div>
                    {totalVariance !== 0 && (
                      <div className="text-end">
                        <p className="text-xs text-text-muted">הפרש</p>
                        <span className={`chip text-xs ${totalVariance > 0 ? 'status-stopped' : 'status-active'}`}>
                          {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                        </span>
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
    </div>
  )
}
