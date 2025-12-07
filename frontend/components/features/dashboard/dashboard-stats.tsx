/**
 * @fileoverview Dashboard Statistics Cards
 * Displays budget, orders, and guest orders statistics.
 * Extracted from page.tsx to follow Single Responsibility Principle.
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, ShoppingCart, Users } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { DashboardStats as DashboardStatsType } from '@/lib/api/home'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardStatsProps {
  dashboard: DashboardStatsType
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Budget Card - Shows total budget and forecast
 */
function BudgetCard({ dashboard }: DashboardStatsProps) {
  const usedPercentage =
    dashboard.totalBudget > 0 ? Math.min((dashboard.forecast / dashboard.totalBudget) * 100, 100) : 0

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-purple-500/5" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 p-1.5 shadow-sm">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">Бюджет проекта</CardTitle>
              <p className="text-[10px] text-muted-foreground">Финансы и расходы</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        {/* Общий бюджет с графиком */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Текущий баланс</span>
            <span className="text-sm font-bold">{dashboard.totalBudget.toLocaleString()} TJS</span>
          </div>
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[{ name: 'Бюджет', Использовано: usedPercentage }]}
              >
                <defs>
                  <linearGradient id="budgetGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6528f5" stopOpacity={1} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" hide />
                <Bar
                  dataKey="Использовано"
                  fill="url(#budgetGradient)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Использовано</span>
            <span className="font-semibold text-foreground">{usedPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Прогноз расходов */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Прогноз расходов</span>
            <span className="text-sm font-bold">{dashboard.forecast.toLocaleString()} TJS</span>
          </div>
          <div className="rounded-lg border bg-muted/30 p-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Остаток</span>
              <span className="text-[10px] font-semibold">
                {(dashboard.totalBudget - dashboard.forecast).toLocaleString()} TJS
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Orders Card - Shows total and active orders
 */
function OrdersCard({ dashboard }: DashboardStatsProps) {
  const inactiveOrders = dashboard.totalOrders - dashboard.activeOrders
  const activePercentage =
    dashboard.totalOrders > 0 ? (dashboard.activeOrders / dashboard.totalOrders) * 100 : 0
  const inactivePercentage =
    dashboard.totalOrders > 0 ? (inactiveOrders / dashboard.totalOrders) * 100 : 0

  return (
    <Card className="relative overflow-hidden border-2 border-blue-500/20">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-1.5 shadow-sm">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">Заказы</CardTitle>
              <p className="text-[10px] text-muted-foreground">Статистика заказов</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        {/* Основная метрика */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Всего заказов</p>
            <p className="text-lg font-bold mt-0.5">{dashboard.totalOrders}</p>
          </div>
          <div className="h-14 w-14">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Активные', value: dashboard.activeOrders, fill: '#3b82f6' },
                    { name: 'Неактивные', value: inactiveOrders, fill: '#c7d2fe' },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={12}
                  outerRadius={20}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell key="active" fill="#3b82f6" />
                  <Cell key="inactive" fill="#c7d2fe" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Детализация */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] text-muted-foreground">Активных</span>
            </div>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {dashboard.activeOrders}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{activePercentage.toFixed(0)}%</p>
          </div>
          <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="text-[10px] text-muted-foreground">Неактивных</span>
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{inactiveOrders}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{inactivePercentage.toFixed(0)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Guest Orders Card - Shows guest order statistics
 */
function GuestOrdersCard({ dashboard }: DashboardStatsProps) {
  const activeGuestPercentage =
    dashboard.guestOrders > 0 ? (dashboard.activeGuestOrders / dashboard.guestOrders) * 100 : 0
  const pausedGuestPercentage =
    dashboard.guestOrders > 0 ? (dashboard.pausedGuestOrders / dashboard.guestOrders) * 100 : 0
  const guestSharePercentage =
    dashboard.totalOrders > 0 ? (dashboard.guestOrders / dashboard.totalOrders) * 100 : 0

  return (
    <Card className="relative overflow-hidden border-2 border-orange-500/20">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-red-500/5" />
      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 p-1.5 shadow-sm">
              <Users className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">Гостевые заказы</CardTitle>
              <p className="text-[10px] text-muted-foreground">Статус гостевых заказов</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        {/* Основная метрика */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Всего гостевых</p>
            <p className="text-lg font-bold mt-0.5">{dashboard.guestOrders}</p>
          </div>
          <div className="h-14 w-14">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Активные', value: dashboard.activeGuestOrders, fill: '#f97316' },
                    { name: 'На паузе', value: dashboard.pausedGuestOrders, fill: '#fb923c' },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={12}
                  outerRadius={20}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell key="active" fill="#f97316" />
                  <Cell key="paused" fill="#fb923c" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Детализация */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border bg-primary/5 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground">Активных</span>
            </div>
            <p className="text-sm font-bold">{dashboard.activeGuestOrders}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{activeGuestPercentage.toFixed(0)}%</p>
          </div>
          <div className="rounded-lg border bg-orange-500/10 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span className="text-[10px] text-muted-foreground">На паузе</span>
            </div>
            <p className="text-sm font-bold">{dashboard.pausedGuestOrders}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{pausedGuestPercentage.toFixed(0)}%</p>
          </div>
        </div>

        {/* Сравнение с общими заказами */}
        <div className="rounded-lg border bg-orange-500/5 p-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-muted-foreground">Доля от всех</span>
            <span className="text-[10px] font-semibold">{guestSharePercentage.toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${guestSharePercentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardStats({ dashboard }: DashboardStatsProps) {
  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <BudgetCard dashboard={dashboard} />
      <OrdersCard dashboard={dashboard} />
      <GuestOrdersCard dashboard={dashboard} />
    </div>
  )
}

