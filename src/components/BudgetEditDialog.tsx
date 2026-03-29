import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useUpdateBudget } from '@/hooks/useCampaigns'
import { todayISO, formatCurrency } from '@/lib/format'
import type { CampaignWithBudget } from '@/types'

interface BudgetEditDialogProps {
  open: boolean
  onClose: () => void
  campaign: CampaignWithBudget | null
  clientId: string
}

export const BudgetEditDialog = ({ open, onClose, campaign, clientId }: BudgetEditDialogProps) => {
  const updateBudget = useUpdateBudget()
  const [newBudget, setNewBudget] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayISO())

  const handleSubmit = async () => {
    if (!campaign || !newBudget) return

    try {
      await updateBudget.mutateAsync({
        campaign_id: campaign.id,
        client_id: clientId,
        new_budget: Number(newBudget),
        effective_date: effectiveDate,
        old_budget: campaign.current_daily_budget,
      })
      toast.success('תקציב עודכן בהצלחה')
      onClose()
      setNewBudget('')
    } catch {
      toast.error('שגיאה בעדכון תקציב')
    }
  }

  if (!campaign) return null

  return (
    <Dialog open={open} onClose={onClose} title="עדכון תקציב יומי" maxWidth="400px">
      <div className="flex flex-col gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-text-secondary mb-1">{campaign.name}</p>
          <p className="text-lg font-semibold">
            תקציב נוכחי: {formatCurrency(campaign.current_daily_budget)}
          </p>
        </div>

        <Input
          label="תקציב יומי חדש (₪)"
          type="number"
          placeholder="300"
          value={newBudget}
          onChange={(e) => setNewBudget(e.target.value)}
        />

        <Input
          label="החל מתאריך"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />

        {newBudget && Number(newBudget) !== campaign.current_daily_budget && (
          <div className="glass-card p-3 text-sm text-center">
            <span className="text-danger">{formatCurrency(campaign.current_daily_budget)}</span>
            <span className="text-text-muted mx-3">&larr;</span>
            <span className="text-success">{formatCurrency(Number(newBudget))}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button
            onClick={handleSubmit}
            disabled={!newBudget || Number(newBudget) === campaign.current_daily_budget || updateBudget.isPending}
          >
            {updateBudget.isPending ? 'מעדכן...' : 'עדכן תקציב'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
