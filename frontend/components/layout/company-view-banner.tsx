'use client'

import { Eye, X, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCompanySelectorStore } from '@/stores/company-selector-store'
import { useAuthStore } from '@/stores/auth-store'

export function CompanyViewBanner() {
  const { user } = useAuthStore()
  const { selectedCompanyId, selectedCompanyName, clearSelectedCompany, isViewingOtherCompany } = useCompanySelectorStore()
  
  // Only show for SUPER_ADMIN viewing another company
  if (!user || user.role !== 'SUPER_ADMIN') return null
  if (!isViewingOtherCompany(user.companyId)) return null
  
  return (
    <div className="sticky top-0 z-[60] w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye className="h-4 w-4" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="text-xs font-medium opacity-90 uppercase tracking-wide">
              Режим просмотра
            </span>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 hidden sm:block" />
              <span className="font-semibold text-sm sm:text-base truncate max-w-[200px] sm:max-w-[300px]">
                {selectedCompanyName || 'Компания'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="hidden md:block text-xs opacity-75">
            Редактирование недоступно
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={clearSelectedCompany}
            className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Вернуться</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

