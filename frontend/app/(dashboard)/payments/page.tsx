"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreditCard, Search, Download, Filter } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { FeatureGate } from '@/components/features/feature-gate'

interface Payment {
  id: string
  date: string
  amount: number
  status: string
  method: string
  description: string
}

const getStatusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'success':
    case 'успешный':
      return 'default'
    case 'pending':
    case 'ожидает':
      return 'secondary'
    case 'failed':
    case 'ошибка':
      return 'destructive'
    default:
      return 'outline'
  }
}

export default function PaymentsPage() {
  return (
    <FeatureGate feature="payments">
      <PaymentsContent />
    </FeatureGate>
  )
}

function PaymentsContent() {
  const [loading] = useState(false)
  const [payments] = useState<Payment[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  const columns = useMemo<ColumnDef<Payment>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID транзакции',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.id}</span>,
    },
    {
      accessorKey: 'date',
      header: 'Дата',
      cell: ({ row }) => row.original.date,
    },
    {
      accessorKey: 'amount',
      header: 'Сумма',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.amount} TJS</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Статус',
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)} className="min-w-[76px] justify-center">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'method',
      header: 'Метод оплаты',
      cell: ({ row }) => row.original.method,
    },
    {
      accessorKey: 'description',
      header: 'Описание',
      cell: ({ row }) => row.original.description,
    },
  ], [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            Оплаты
          </h1>
          <p className="text-muted-foreground mt-1">
            Управление платежами и транзакциями
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Фильтры
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего платежей</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">За все время</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Успешные</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0</div>
            <p className="text-xs text-muted-foreground">Обработано</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ожидают</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">0</div>
            <p className="text-xs text-muted-foreground">В обработке</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ошибки</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">0</div>
            <p className="text-xs text-muted-foreground">Неудачные</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Поиск по транзакции..." className="pl-10" />
          </div>
        </div>

        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="success">Успешные</SelectItem>
            <SelectItem value="pending">Ожидают</SelectItem>
            <SelectItem value="failed">Ошибки</SelectItem>
          </SelectContent>
        </Select>

        <DatePicker 
          value={selectedDate} 
          onChange={setSelectedDate} 
          className="w-[180px]"
        />
      </div>

      {/* Payments Table */}
      <DataTable
        columns={columns}
        data={payments}
        isLoading={loading}
        loadingRows={5}
        emptyMessage={
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Платежи не найдены</h3>
            <p className="text-muted-foreground">
              История платежей будет отображаться здесь
            </p>
          </div>
        }
      />
    </div>
  )
}

