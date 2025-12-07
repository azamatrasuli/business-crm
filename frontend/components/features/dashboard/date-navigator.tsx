/**
 * @fileoverview Date Navigator Component
 * Provides date selection and navigation for the dashboard.
 * Extracted from page.tsx to follow Single Responsibility Principle.
 */

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface DateNavigatorProps {
  /** Current display date for the date picker */
  displayDate: Date | null
  /** Whether today is selected */
  isTodaySelected: boolean
  /** Whether any date filter is active */
  hasDateFilter: boolean
  /** Go to previous day */
  onPreviousDay: () => void
  /** Go to next day */
  onNextDay: () => void
  /** Select a specific date */
  onSelectDate: (date: Date | undefined) => void
  /** Show today's orders */
  onShowToday: () => void
  /** Show all orders (remove date filter) */
  onShowAll: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function DateNavigator({
  displayDate,
  isTodaySelected,
  hasDateFilter,
  onPreviousDay,
  onNextDay,
  onSelectDate,
  onShowToday,
  onShowAll,
}: DateNavigatorProps) {
  return (
    <Card className="border-0 shadow-sm py-0">
      <CardContent className="py-3 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Date Picker with Navigation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Выбор даты</span>
            </div>

            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-background"
                onClick={onPreviousDay}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <DatePicker
                value={displayDate ?? undefined}
                onChange={onSelectDate}
                placeholder="Все даты"
                className="w-[130px] border-0 bg-background shadow-sm"
              />

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md hover:bg-background"
                onClick={onNextDay}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isTodaySelected && (
              <Button variant="outline" size="sm" onClick={onShowToday} className="text-xs">
                Сегодня
              </Button>
            )}

            {hasDateFilter ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowAll}
                className="text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="h-3 w-3" />
                Все заказы
              </Button>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Показаны все заказы
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

