"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { FeatureGate } from '@/components/features/feature-gate'

interface NewsItem {
  id: string
  title: string
  description: string
  author: string
  category: string
  date: string
  publishDate: string
}

export default function NewsPage() {
  return (
    <FeatureGate feature="news">
      <NewsContent />
    </FeatureGate>
  )
}

function NewsContent() {
  const [loading] = useState(false)
  const [news] = useState<NewsItem[]>([])

  const columns = useMemo<ColumnDef<NewsItem>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Заголовок',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {row.original.description}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Категория',
      cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
    },
    {
      accessorKey: 'author',
      header: 'Автор',
      cell: ({ row }) => row.original.author,
    },
    {
      accessorKey: 'date',
      header: 'Создано',
      cell: ({ row }) => row.original.date,
    },
    {
      accessorKey: 'publishDate',
      header: 'Публикация',
      cell: ({ row }) => row.original.publishDate,
    },
  ], [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-primary" />
            Новости
          </h1>
          <p className="text-muted-foreground mt-1">
            Управление новостями и объявлениями
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Создать новость
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Поиск новостей..." className="pl-10" />
          </div>
        </div>
      </div>

      {/* News Table */}
      <DataTable
        columns={columns}
        data={news}
        isLoading={loading}
        loadingRows={6}
        emptyMessage={
          <div className="p-12 text-center">
            <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Новости не найдены</h3>
            <p className="text-muted-foreground mb-4">
              Начните с создания первой новости
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Создать новость
            </Button>
          </div>
        }
      />
    </div>
  )
}

