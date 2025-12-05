"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useUsersStore } from '@/stores/users-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SortableHeader, useSort, sortData } from '@/components/ui/sortable-header'
import { Plus, Pencil, Trash2, Users as UsersIcon, Shield, TrendingUp } from 'lucide-react'
import { CreateUserDialog } from '@/components/features/users/create-user-dialog'
import { EditUserDialog } from '@/components/features/users/edit-user-dialog'
import { DeleteUserDialog } from '@/components/features/users/delete-user-dialog'
import type { User } from '@/lib/api/users'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'

export default function UsersPage() {
  const { users, loading, error, total, currentPage, totalPages, fetchUsers, fetchAvailableRoutes } = useUsersStore()
  const { user: currentUser } = useAuthStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { sortConfig, toggleSort } = useSort<string>()
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchUsers(1)
    fetchAvailableRoutes()
  }, [fetchUsers, fetchAvailableRoutes])

  const activeAdmins = useMemo(
    () =>
      users.filter((user) => {
        const roleName = user.role?.toLowerCase() || ''
        const isAdminRole = roleName.includes('admin')
        const isBlocked = user.status === 'Заблокирован'
        return isAdminRole && !isBlocked
      }),
    [users]
  )

  // Статистика пользователей
  const usersStats = useMemo(() => {
    const totalUsers = users.length
    const activeUsers = users.filter((u) => u.status === 'Активный').length
    const blockedUsers = users.filter((u) => u.status === 'Заблокирован').length
    
    // Распределение по ролям
    const rolesMap = new Map<string, number>()
    users.forEach((user) => {
      const role = user.role || 'Без роли'
      rolesMap.set(role, (rolesMap.get(role) || 0) + 1)
    })
    const rolesDistribution = Array.from(rolesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Администраторы
    const admins = users.filter((u) => {
      const roleName = u.role?.toLowerCase() || ''
      return roleName.includes('admin')
    }).length

    // Процент активных
    const activePercentage = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0

    return {
      totalUsers,
      activeUsers,
      blockedUsers,
      rolesDistribution,
      admins,
      activePercentage,
    }
  }, [users])

  const handleEdit = useCallback((user: User) => {
    setSelectedUser(user)
    setEditOpen(true)
  }, [])

  const handleDelete = useCallback((user: User) => {
    setSelectedUser(user)
    setDeleteOpen(true)
  }, [])

  const handlePageChange = (page: number) => {
    fetchUsers(page)
  }

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'Активный':
        return 'default'
      case 'Заблокирован':
        return 'destructive'
      default:
        return 'secondary'
    }
  }, [])

  // Sort users with custom comparators
  const sortedUsers = useMemo(() => {
    return sortData(users, sortConfig, {
      status: (a, b) => {
        const order = { 'Активный': 2, 'Заблокирован': 1 }
        return (order[a.status as keyof typeof order] || 0) - (order[b.status as keyof typeof order] || 0)
      },
    })
  }, [users, sortConfig])

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: 'fullName',
      header: () => (
        <SortableHeader
          label="ФИО"
          field="fullName"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    {
      accessorKey: 'phone',
      header: () => (
        <SortableHeader
          label="Телефон"
          field="phone"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => row.original.phone,
    },
    {
      accessorKey: 'email',
      header: () => (
        <SortableHeader
          label="Email"
          field="email"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: 'role',
      header: () => (
        <SortableHeader
          label="Роль"
          field="role"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => row.original.role,
    },
    {
      accessorKey: 'status',
      header: () => (
        <SortableHeader
          label="Статус"
          field="status"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => (
        <Badge variant={getStatusColor(row.original.status)} className="min-w-[96px] justify-center">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => {
        const user = row.original
        const isSelf = user.id === currentUser?.id
        const isLastAdmin =
          activeAdmins.length <= 1 &&
          activeAdmins.some((admin) => admin.id === user.id)
        const deleteDisabled = isSelf || isLastAdmin
        const tooltipMessage = isSelf
          ? 'Вы не можете удалить себя'
          : 'Нельзя удалить последнего Admin'

        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(user)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {deleteDisabled ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{tooltipMessage}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(user)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ], [activeAdmins, currentUser?.id, getStatusColor, handleDelete, handleEdit, sortConfig, toggleSort])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
            <UsersIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Пользователи
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Управление пользователями системы
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="lg" className="gap-2 w-full sm:w-auto">
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Создать пользователя</span>
          <span className="sm:hidden">Создать</span>
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {users.length > 0 && (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Общая статистика */}
          <Card className="relative overflow-hidden border-2 border-primary/20">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-purple-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 p-1.5 shadow-sm">
                    <UsersIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Пользователи</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Общая статистика</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Всего пользователей</p>
                  <p className="text-lg font-bold mt-0.5">{usersStats.totalUsers}</p>
                </div>
                <div className="h-14 w-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Активные', value: usersStats.activeUsers, fill: '#6528f5' },
                          { name: 'Заблокированные', value: usersStats.blockedUsers, fill: '#c7d2fe' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={12}
                        outerRadius={20}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell key="active" fill="#6528f5" />
                        <Cell key="blocked" fill="#c7d2fe" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-muted-foreground">Активных</span>
                  </div>
                  <p className="text-sm font-bold text-primary">{usersStats.activeUsers}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {usersStats.activePercentage.toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="text-[10px] text-muted-foreground">Заблокированных</span>
                  </div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{usersStats.blockedUsers}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {((usersStats.blockedUsers / usersStats.totalUsers) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Распределение по ролям */}
          <Card className="relative overflow-hidden border-2 border-blue-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-1.5 shadow-sm">
                    <Shield className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Роли</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Распределение по ролям</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-2">
              <div className="h-12 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={usersStats.rolesDistribution.slice(0, 3).map((role) => ({
                      name: role.name.length > 10 ? role.name.substring(0, 10) + '...' : role.name,
                      value: role.value,
                    }))}
                  >
                    <defs>
                      <linearGradient id="roleGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" hide />
                    <Bar dataKey="value" fill="url(#roleGradient)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {usersStats.rolesDistribution.slice(0, 3).map((role, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground truncate flex-1">{role.name}</span>
                    <span className="font-semibold ml-2">{role.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Статусы пользователей */}
          <Card className="relative overflow-hidden border-2 border-orange-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-red-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 p-1.5 shadow-sm">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Статусы</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Активность пользователей</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-2">
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">Активных</span>
                  <span className="text-sm font-bold">{usersStats.activeUsers}</span>
                </div>
                <div className="h-12 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={[
                        {
                          name: 'Активность',
                          Использовано: usersStats.totalUsers > 0
                            ? (usersStats.activeUsers / usersStats.totalUsers) * 100
                            : 0,
                        },
                      ]}
                    >
                      <defs>
                        <linearGradient id="statusGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                          <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis dataKey="name" type="category" hide />
                      <Bar
                        dataKey="Использовано"
                        fill="url(#statusGradient)"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Заблокированных</span>
                  <span className="font-semibold text-foreground">
                    {usersStats.totalUsers > 0
                      ? ((usersStats.blockedUsers / usersStats.totalUsers) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-1.5">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Активных</div>
                  <div className="text-xs font-bold">{usersStats.activeUsers}</div>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-1.5">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Заблокированных</div>
                  <div className="text-xs font-bold">{usersStats.blockedUsers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={sortedUsers}
        isLoading={loading && users.length === 0}
        loadingRows={5}
        emptyMessage={
          <div className="p-12 text-center">
            <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Пользователи не найдены</h3>
            <p className="text-muted-foreground mb-4">
              Начните с создания первого пользователя
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать пользователя
            </Button>
          </div>
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-card px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Показано {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, total)} из {total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
            >
              Вперед
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selectedUser && (
        <>
          <EditUserDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            user={selectedUser}
          />
          <DeleteUserDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            user={selectedUser}
          />
        </>
      )}
    </div>
  )
}

