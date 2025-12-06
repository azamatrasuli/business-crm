'use client'

import { useState } from 'react'
import { useUsersStore } from '@/stores/users-store'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@/lib/api/users'

interface DeleteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
}

const DeleteUserDialogComponent = ({ open, onOpenChange, user }: DeleteUserDialogProps) => {
  const { deleteUser } = useUsersStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    logger.action('DeleteUserAttempt', { userId: user.id })
    
    try {
      await deleteUser(user.id)
      
      logger.info('User deleted successfully', { userId: user.id })
      toast.success('Пользователь успешно удален')
      toast.message(`Отправили уведомление на ${user.email}`)
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)
      
      logger.error('Delete user failed', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
        userId: user.id,
      })
      
      // Special handling for specific errors
      if (appError.code === ErrorCodes.USER_CANNOT_DELETE_SELF) {
        toast.error('Нельзя удалить самого себя', {
          description: 'Попросите другого администратора удалить ваш аккаунт',
        })
      } else if (appError.code === ErrorCodes.USER_CANNOT_DELETE_LAST_ADMIN) {
        toast.error('Невозможно удалить последнего администратора', {
          description: 'В компании должен остаться хотя бы один администратор',
        })
      } else {
        toast.error(appError.message, {
          description: appError.action,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col">
        <div className="flex flex-col flex-1 min-h-0">
          <DialogHeader>
            <DialogTitle>Удалить пользователя</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить пользователя «{user.fullName}»? Это действие необратимо,
              пользователь потеряет доступ немедленно.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                После удаления система автоматически отправит письмо на{' '}
                <span className="font-semibold">{user.email}</span> с уведомлением «Ваш аккаунт был
                удален».
              </AlertDescription>
            </Alert>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { DeleteUserDialogComponent as DeleteUserDialog }

