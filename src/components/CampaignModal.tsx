import { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useCreateCampaign, useUpdateBudget, useUpdateCampaignStatus } from '@/hooks/useCampaigns'
import { todayISO, formatCurrency } from '@/lib/format'
import type { CampaignWithBudget, CampaignStatus } from '@/types'

interface CampaignModalProps {
  open: boolean
  onClose: () => void
  clientId: string
  campaign?: CampaignWithBudget | null
}

const campaignTypes = [
  'Sales', 'Awareness', 'Shopping', 'Brand', 'GDN',
  'Search', 'PMax', 'Remarketing', 'Leads', 'Traffic',
  'Engagement', 'Video', 'App',
]

export const CampaignModal = ({ open, onClose, clientId, campaign }: CampaignModalProps) => {
  const isEditing = !!campaign
  const createCampaign = useCreateCampaign()
  const updateBudget = useUpdateBudget()
  const updateStatus = useUpdateCampaignStatus()

  const [name, setName] = useState('')
  const [technicalName, setTechnicalName] = useState('')
  const [platform, setPlatform] = useState<'facebook' | 'google'>('facebook')
  const [campaignType, setCampaignType] = useState('')
  const [dailyBudget, setDailyBudget] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [adLink, setAdLink] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<CampaignStatus>('active')

  useEffect(() => {
    if (campaign) {
      setName(campaign.name)
      setTechnicalName(campaign.technical_name ?? '')
      setPlatform(campaign.platform)
      setCampaignType(campaign.campaign_type ?? '')
      setDailyBudget(String(campaign.current_daily_budget))
      setStartDate(campaign.start_date)
      setAdLink(campaign.ad_link ?? '')
      setNotes(campaign.notes ?? '')
      setStatus(campaign.status)
    } else {
      setName('')
      setTechnicalName('')
      setPlatform('facebook')
      setCampaignType('')
      setDailyBudget('')
      setStartDate(todayISO())
      setAdLink('')
      setNotes('')
      setStatus('active')
    }
  }, [campaign, open])

  const handleSubmit = async () => {
    if (!name.trim() || !dailyBudget) return

    try {
      if (isEditing && campaign) {
        // Budget change
        const newBudget = Number(dailyBudget)
        if (newBudget !== campaign.current_daily_budget) {
          await updateBudget.mutateAsync({
            campaign_id: campaign.id,
            client_id: clientId,
            new_budget: newBudget,
            effective_date: todayISO(),
            old_budget: campaign.current_daily_budget,
          })
        }
        // Status change
        if (status !== campaign.status) {
          await updateStatus.mutateAsync({
            campaign_id: campaign.id,
            client_id: clientId,
            status,
            end_date: status === 'stopped' ? todayISO() : undefined,
          })
        }
        toast.success('קמפיין עודכן בהצלחה')
      } else {
        await createCampaign.mutateAsync({
          client_id: clientId,
          name: name.trim(),
          technical_name: technicalName.trim() || undefined,
          platform,
          campaign_type: campaignType || undefined,
          daily_budget: Number(dailyBudget),
          start_date: startDate,
          ad_link: adLink.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        toast.success('קמפיין חדש נוסף בהצלחה')
      }
      onClose()
    } catch {
      toast.error('שגיאה בשמירת קמפיין')
    }
  }

  const isPending = createCampaign.isPending || updateBudget.isPending || updateStatus.isPending

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'עריכת קמפיין' : 'הוסף קמפיין חדש'}
      maxWidth="600px"
    >
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pe-2">
        <Input
          label="שם קמפיין"
          placeholder="לדוגמה: קמפיין המרות - מבצע חורף"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="שם טכני"
          placeholder="Bright | Conv | Winter | 01.01.26"
          value={technicalName}
          onChange={(e) => setTechnicalName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="פלטפורמה"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as 'facebook' | 'google')}
          >
            <option value="facebook">Meta (Facebook)</option>
            <option value="google">Google Ads</option>
          </Select>

          <Select
            label="סוג קמפיין"
            value={campaignType}
            onChange={(e) => setCampaignType(e.target.value)}
          >
            <option value="">בחר סוג</option>
            {campaignTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="תקציב יומי (₪)"
            type="number"
            placeholder="200"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
          />
          <Input
            label="תאריך התחלה"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isEditing}
          />
        </div>

        {isEditing && campaign && Number(dailyBudget) !== campaign.current_daily_budget && (
          <div className="glass-card p-3 text-sm">
            <span className="text-text-secondary">שינוי תקציב: </span>
            <span className="text-danger">{formatCurrency(campaign.current_daily_budget)}</span>
            <span className="text-text-muted mx-2">&larr;</span>
            <span className="text-success">{formatCurrency(Number(dailyBudget))}</span>
            <span className="text-text-muted me-2"> (החל מהיום)</span>
          </div>
        )}

        {isEditing && (
          <Select
            label="סטטוס"
            value={status}
            onChange={(e) => setStatus(e.target.value as CampaignStatus)}
          >
            <option value="active">פעיל</option>
            <option value="paused">מושהה</option>
            <option value="stopped">הופסק</option>
          </Select>
        )}

        <Input
          label="קישור למודעה"
          type="url"
          placeholder="https://..."
          value={adLink}
          onChange={(e) => setAdLink(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium tracking-wider text-text-muted">
            הערות
          </label>
          <textarea
            className="glass-input glass-textarea"
            placeholder="הערות (אופציונלי)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-[rgba(255,255,255,0.08)]">
        <Button variant="ghost" onClick={onClose}>
          ביטול
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || !dailyBudget || isPending}
        >
          {isPending ? 'שומר...' : isEditing ? 'שמור שינויים' : 'הוסף קמפיין'}
        </Button>
      </div>
    </Dialog>
  )
}
