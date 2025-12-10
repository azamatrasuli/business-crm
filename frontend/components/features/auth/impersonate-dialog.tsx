'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { logger } from '@/lib/logger'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Search, User, Building2, LogIn, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImpersonateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImpersonateDialog({ open, onOpenChange }: ImpersonateDialogProps) {
  const { user, allAdmins, adminsLoading, fetchAllAdmins, impersonate } = useAuthStore()
  const [search, setSearch] = useState('')
  const [impersonating, setImpersonating] = useState<string | null>(null)

  // Fetch admins when dialog opens
  useEffect(() => {
    if (open && allAdmins.length === 0) {
      fetchAllAdmins().catch((err) => logger.error('Failed to fetch admins in dialog', err instanceof Error ? err : new Error(String(err))))
    }
  }, [open, allAdmins.length, fetchAllAdmins])

  // Filter admins by search
  const filteredAdmins = useMemo(() => {
    if (!search.trim()) return allAdmins

    const searchLower = search.toLowerCase()
    return allAdmins.filter(admin =>
      admin.fullName.toLowerCase().includes(searchLower) ||
      admin.companyName.toLowerCase().includes(searchLower) ||
      admin.phone.includes(search) ||
      admin.email.toLowerCase().includes(searchLower)
    )
  }, [allAdmins, search])

  // Group admins by company
  const adminsByCompany = useMemo(() => {
    const groups: Record<string, typeof filteredAdmins> = {}
    for (const admin of filteredAdmins) {
      // Skip current user
      if (admin.id === user?.id) continue

      if (!groups[admin.companyName]) {
        groups[admin.companyName] = []
      }
      groups[admin.companyName].push(admin)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredAdmins, user?.id])

  const handleImpersonate = async (adminId: string, adminName: string) => {
    try {
      setImpersonating(adminId)
      await impersonate(adminId)
      toast.success(`Вы вошли как ${adminName}`)
      onOpenChange(false)
    } catch (error) {
      logger.error('Impersonation failed in dialog', error instanceof Error ? error : new Error(String(error)))
      toast.error('Не удалось войти под другим пользователем')
      setImpersonating(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Войти как другой админ
          </DialogTitle>
          <DialogDescription>
            Выберите администратора для входа от его имени. Вы сможете вернуться к своему аккаунту в любой момент.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени, компании, телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Admins list */}
          <ScrollArea className="h-[350px] -mx-6 mt-4">
            <div className="px-6">
              {adminsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Загрузка...</span>
                </div>
              ) : adminsByCompany.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {search ? 'Ничего не найдено' : 'Нет доступных администраторов'}
                </div>
              ) : (
                <div className="space-y-6">
                  {adminsByCompany.map(([companyName, admins]) => (
                    <div key={companyName}>
                      {/* Company header */}
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                        <Building2 className="h-4 w-4 text-primary/70" />
                        <span className="text-sm font-semibold text-foreground">
                          {companyName}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                          {admins.length}
                        </Badge>
                      </div>

                      {/* Admin cards */}
                      <div className="space-y-2">
                        {admins.map((admin) => (
                          <div
                            key={admin.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">
                                  {admin.fullName}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                                  {admin.role}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {admin.phone} • {admin.email}
                              </div>
                              {admin.projectName && (
                                <div className="text-xs text-muted-foreground/70 mt-0.5">
                                  Проект: {admin.projectName}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonate(admin.id, admin.fullName)}
                              disabled={impersonating !== null}
                              className="shrink-0 h-8 px-3 gap-1.5"
                            >
                              {impersonating === admin.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <LogIn className="h-3.5 w-3.5" />
                                  <span>Войти</span>
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
