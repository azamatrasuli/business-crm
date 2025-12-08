"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useUsersStore } from '@/stores/users-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SortableHeader, useSort, sortData } from '@/components/ui/sortable-header'
import { Plus, Pencil, Trash2, Users as UsersIcon } from 'lucide-react'
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

export default function UsersPage() {
  const { users, isLoading: loading, error, total, currentPage, totalPages, fetchUsers, fetchAvailableRoutes } = useUsersStore()
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

