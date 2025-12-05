"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TrendingUp, Users, ShoppingCart, DollarSign, Calendar } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { FeatureGate } from '@/components/features/feature-gate'

type EmployeeStat = {
  name: string
  orders: number
  spend: number
}

type AddressStat = {
  address: string
  orders: number
  share: string
}

type ActivityStat = {
  day: string
  orders: number
  change: string
}

const MOCK_ANALYTICS: Record<
  string,
  {
    topEmployees: EmployeeStat[]
    addresses: AddressStat[]
    activity: ActivityStat[]
  }
> = {
  week: {
    topEmployees: [
      { name: 'Иван Петров', orders: 12, spend: 420 },
      { name: 'Анна Смирнова', orders: 10, spend: 360 },
      { name: 'Даврон Саидов', orders: 9, spend: 330 },
    ],
    addresses: [
      { address: 'Бизнес-центр Заря', orders: 28, share: '32%' },
      { address: 'Офис Arena', orders: 21, share: '24%' },
      { address: 'Yalla HQ', orders: 19, share: '22%' },
    ],
    activity: [
      { day: 'Пн', orders: 18, change: '+8%' },
      { day: 'Вт', orders: 16, change: '+5%' },
      { day: 'Ср', orders: 14, change: '-3%' },
    ],
  },
  month: {
    topEmployees: [
      { name: 'Иван Петров', orders: 48, spend: 1620 },
      { name: 'Анна Смирнова', orders: 44, spend: 1540 },
      { name: 'Даврон Саидов', orders: 39, spend: 1380 },
    ],
    addresses: [
      { address: 'Бизнес-центр Заря', orders: 103, share: '29%' },
      { address: 'Офис Arena', orders: 88, share: '25%' },
      { address: 'Yalla HQ', orders: 72, share: '20%' },
    ],
    activity: [
      { day: '1-7', orders: 96, change: '+6%' },
      { day: '8-14', orders: 90, change: '+2%' },
      { day: '15-21', orders: 84, change: '-4%' },
    ],
  },
  quarter: {
    topEmployees: [],
    addresses: [],
    activity: [],
  },
  year: {
    topEmployees: [],
    addresses: [],
    activity: [],
  },
}

export default function AnalyticsPage() {
  return (
    <FeatureGate feature="analytics">
      <AnalyticsContent />
    </FeatureGate>
  )
}

function AnalyticsContent() {
  const [period, setPeriod] = useState('month')

  const dataset = useMemo(() => MOCK_ANALYTICS[period] ?? MOCK_ANALYTICS.month, [period])

  const topEmployeesColumns = useMemo<ColumnDef<EmployeeStat>[]>(() => [
    { accessorKey: 'name', header: 'Сотрудник' },
    {
      accessorKey: 'orders',
      header: 'Заказы',
      cell: ({ row }) => row.original.orders,
    },
    {
      accessorKey: 'spend',
      header: 'Сумма, TJS',
      cell: ({ row }) => row.original.spend.toLocaleString('ru-RU'),
    },
  ], [])

  const addressColumns = useMemo<ColumnDef<AddressStat>[]>(() => [
    { accessorKey: 'address', header: 'Адрес' },
    {
      accessorKey: 'orders',
      header: 'Заказы',
      cell: ({ row }) => row.original.orders,
    },
    { accessorKey: 'share', header: 'Доля' },
  ], [])

  const activityColumns = useMemo<ColumnDef<ActivityStat>[]>(() => [
    { accessorKey: 'day', header: 'Период' },
    {
      accessorKey: 'orders',
      header: 'Заказы',
      cell: ({ row }) => row.original.orders,
    },
    { accessorKey: 'change', header: 'Δ' },
  ], [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            Аналитика
          </h1>
          <p className="text-muted-foreground mt-1">
            Статистика и аналитика по использованию системы
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="quarter">Квартал</SelectItem>
              <SelectItem value="year">Год</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Выбрать период
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активных пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">+0% с прошлого периода</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего заказов</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">+0% с прошлого периода</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общая выручка</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 TJS</div>
            <p className="text-xs text-muted-foreground">+0% с прошлого периода</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний чек</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 TJS</div>
            <p className="text-xs text-muted-foreground">+0% с прошлого периода</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Динамика заказов</CardTitle>
            <CardDescription>График заказов за выбранный период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] rounded-lg border border-dashed flex items-center justify-center text-muted-foreground">
              Визуализация появится после подключения метрик
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Распределение по категориям</CardTitle>
            <CardDescription>Статистика по типам заказов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] rounded-lg border border-dashed flex items-center justify-center text-muted-foreground">
              Визуализация появится после подключения метрик
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Топ сотрудники</CardTitle>
            <CardDescription>По количеству заказов</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={topEmployeesColumns}
              data={dataset.topEmployees}
              isLoading={false}
              loadingRows={3}
              emptyMessage={
                <div className="py-8 text-center text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Популярные адреса</CardTitle>
            <CardDescription>Чаще всего используемые</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={addressColumns}
              data={dataset.addresses}
              isLoading={false}
              loadingRows={3}
              emptyMessage={
                <div className="py-8 text-center text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Активность по периодам</CardTitle>
            <CardDescription>Распределение заказов</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={activityColumns}
              data={dataset.activity}
              isLoading={false}
              loadingRows={3}
              emptyMessage={
                <div className="py-8 text-center text-muted-foreground">
                  Нет данных за выбранный период
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

