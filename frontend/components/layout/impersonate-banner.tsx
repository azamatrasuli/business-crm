'use client'

import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { User, XCircle } from 'lucide-react'

export function ImpersonateBanner() {
  const { user, isImpersonating, stopImpersonating, originalUser } = useAuthStore()

  if (!isImpersonating || !user) {
    return null
  }

  return (
    <div className="bg-orange-500 text-white py-2 px-4 text-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4" />
        <span>
          Вы вошли как:{' '}
          <span className="font-semibold">{user.fullName}</span>
          {user.companyName && (
            <span className="opacity-80"> ({user.companyName})</span>
          )}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={stopImpersonating}
        className="text-white hover:bg-orange-600 hover:text-white"
      >
        <XCircle className="h-4 w-4 mr-2" />
        Вернуться к {originalUser?.fullName || 'своему аккаунту'}
      </Button>
    </div>
  )
}

