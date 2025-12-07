/**
 * @fileoverview Employees Statistics Cards
 * Displays employee statistics with charts.
 * Extracted from employees/page.tsx to follow Single Responsibility Principle.
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Wallet, UtensilsCrossed } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { EmployeesStats as StatsType } from '@/lib/hooks/use-employees-page'
import { formatTJS, formatPercent } from '@/lib/utils/format'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeesStatsProps {
  stats: StatsType
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════════

function StatusCard({ stats }: EmployeesStatsProps) {
  const activePercent =
    stats.totalEmployees > 0
      ? (stats.activeEmployees / stats.totalEmployees) * 100
      : 0

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-purple-500/5" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 p-1.5 shadow-sm">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Сотрудники</CardTitle>
            <p className="text-[10px] text-muted-foreground">Статус активности</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Всего</p>
            <p className="text-lg font-bold">{stats.totalEmployees}</p>
          </div>
          <div className="h-14 w-14">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={12}
                  outerRadius={20}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {stats.statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground">Активных</span>
            </div>
            <p className="text-sm font-bold text-emerald-600">{stats.activeEmployees}</p>
            <p className="text-[10px] text-muted-foreground">{formatPercent(activePercent)}</p>
          </div>
          <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-[10px] text-muted-foreground">Неактивных</span>
            </div>
            <p className="text-sm font-bold text-slate-600">{stats.inactiveEmployees}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatPercent(100 - activePercent)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetCard({ stats }: EmployeesStatsProps) {
  return (
    <Card className="relative overflow-hidden border-2 border-blue-500/20">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-1.5 shadow-sm">
            <Wallet className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Бюджеты</CardTitle>
            <p className="text-[10px] text-muted-foreground">Сводка по бюджетам</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Общий бюджет</p>
          <p className="text-lg font-bold">{formatTJS(stats.totalBudget)}</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border bg-blue-500/5 p-1.5">
            <span className="text-[10px] text-muted-foreground">Средний</span>
            <p className="text-sm font-bold text-blue-600">{formatTJS(Math.round(stats.avgBudget))}</p>
          </div>
          <div className="rounded-lg border bg-indigo-500/5 p-1.5">
            <span className="text-[10px] text-muted-foreground">Максимум</span>
            <p className="text-sm font-bold text-indigo-600">{formatTJS(stats.maxBudget)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ServiceTypeCard({ stats }: EmployeesStatsProps) {
  return (
    <Card className="relative overflow-hidden border-2 border-amber-500/20">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/5" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-1.5 shadow-sm">
            <UtensilsCrossed className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Услуги</CardTitle>
            <p className="text-[10px] text-muted-foreground">Типы услуг</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Распределение</p>
            <p className="text-lg font-bold">{stats.lunchCount + stats.compensationCount}</p>
          </div>
          <div className="h-14 w-14">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.serviceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={12}
                  outerRadius={20}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {stats.serviceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-1">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-[9px] text-muted-foreground">Ланч</span>
            </div>
            <p className="text-xs font-bold text-amber-600">{stats.lunchCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-1">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] text-muted-foreground">Комп.</span>
            </div>
            <p className="text-xs font-bold text-emerald-600">{stats.compensationCount}</p>
          </div>
          <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-1">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-[9px] text-muted-foreground">Нет</span>
            </div>
            <p className="text-xs font-bold text-slate-600">{stats.noServiceCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeesStats({ stats }: EmployeesStatsProps) {
  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <StatusCard stats={stats} />
      <BudgetCard stats={stats} />
      <ServiceTypeCard stats={stats} />
    </div>
  )
}

