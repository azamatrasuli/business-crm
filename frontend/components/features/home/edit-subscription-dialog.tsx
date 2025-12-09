'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useHomeStore } from '@/stores/home-store'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Order, ComboType } from '@/lib/api/home'
import { COMBO_METADATA, COMBO_TYPES } from '@/lib/combos'

interface EditSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
}

export function EditSubscriptionDialog({ open, onOpenChange, order }: EditSubscriptionDialogProps) {
  const { bulkAction } = useHomeStore()
  const [comboType, setComboType] = useState<ComboType>('Комбо 25')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Текущие значения из заказа
  const currentCombo = order?.comboType as ComboType | undefined
  // Address comes from project (immutable)
  const currentAddress = order?.address || 'Из проекта'

  // Форматируем дату заказа
  const orderDateFormatted = order?.date 
    ? format(new Date(order.date), 'EEEE, d MMMM', { locale: ru }).replace(/^./, (c) => c.toUpperCase())
    : ''

  // Проверяем что изменилось
  const comboChanged = comboType !== currentCombo
  const hasChanges = comboChanged

  useEffect(() => {
    if (open && order) {
      setComboType((order.comboType as ComboType) || 'Комбо 25')
    }
  }, [open, order])

  const handleSubmit = async () => {
    if (!order?.id) {
      toast.error('Не удалось определить заказ')
      return
    }
    
    if (!hasChanges) {
      toast.info('Нет изменений для сохранения')
      return
    }

    // NOTE: Address cannot be changed - it comes from employee's project

    setIsSubmitting(true)
    try {
      // Меняем комбо только для ЭТОГО заказа, а не всей подписки
      await bulkAction({
        orderIds: [order.id],
        action: 'changecombo',
        comboType,
      })
      toast.success(`Комбо изменено на ${comboType}`, {
        description: `Заказ на ${orderDateFormatted}`,
      })
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to change order combo', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      toast.error(appError.message, { description: appError.action })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Изменить комбо на день</DialogTitle>
          <DialogDescription>
            Изменение применится только к заказу на {orderDateFormatted}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>{order.employeeName}</strong> — {orderDateFormatted}
              <br />
              <span className="text-muted-foreground">
                Текущий комбо: {currentCombo || 'не указан'}
              </span>
              <br />
              <span className="text-muted-foreground text-xs">
                📍 Адрес: {currentAddress} (из проекта)
              </span>
            </AlertDescription>
          </Alert>

          {/* Combo Selection */}
          <div className="space-y-2">
            <Label>Тип комбо *</Label>
            <RadioGroup 
              value={comboType} 
              onValueChange={(v) => setComboType(v as ComboType)}
              className="grid grid-cols-1 gap-2"
            >
              {COMBO_TYPES.map((combo) => {
                const data = COMBO_METADATA[combo]
                return (
                  <label
                    key={combo}
                    htmlFor={`edit-${combo}`}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <RadioGroupItem value={combo} id={`edit-${combo}`} />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <span>{data.icon}</span>
                        {data.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.features.join(' • ')}
                      </p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </div>

          {/* Info about scope of change */}
          <Alert className="bg-muted/50">
            <AlertDescription className="text-sm">
              💡 Изменение комбо применится только к этому заказу.
              Для изменения всей подписки используйте «Управлять обедами».
            </AlertDescription>
          </Alert>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить изменения'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
