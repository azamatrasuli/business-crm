'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getAllCompanies, type CompanyListItem } from '@/lib/api/companies'

interface CompanySelectorState {
  // Selected company for SUPER_ADMIN
  selectedCompanyId: string | null
  selectedCompanyName: string | null
  
  // All companies list
  companies: CompanyListItem[]
  isLoadingCompanies: boolean
  
  // Actions
  setSelectedCompany: (companyId: string, companyName: string) => void
  clearSelectedCompany: () => void
  fetchCompanies: () => Promise<void>
  
  // Computed - returns selected company or user's company
  getEffectiveCompanyId: (userCompanyId: string) => string
}

export const useCompanySelectorStore = create<CompanySelectorState>()(
  persist(
    (set, get) => ({
      selectedCompanyId: null,
      selectedCompanyName: null,
      companies: [],
      isLoadingCompanies: false,
      
      setSelectedCompany: (companyId: string, companyName: string) => {
        set({ 
          selectedCompanyId: companyId,
          selectedCompanyName: companyName 
        })
        // Reload page to refresh all data
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      },
      
      clearSelectedCompany: () => {
        set({ 
          selectedCompanyId: null,
          selectedCompanyName: null,
          companies: []
        })
      },
      
      fetchCompanies: async () => {
        set({ isLoadingCompanies: true })
        try {
          const companies = await getAllCompanies()
          set({ companies, isLoadingCompanies: false })
        } catch (error) {
          console.error('Failed to fetch companies:', error)
          set({ companies: [], isLoadingCompanies: false })
        }
      },
      
      getEffectiveCompanyId: (userCompanyId: string) => {
        const { selectedCompanyId } = get()
        return selectedCompanyId || userCompanyId
      }
    }),
    {
      name: 'company-selector',
      partialize: (state) => ({
        selectedCompanyId: state.selectedCompanyId,
        selectedCompanyName: state.selectedCompanyName,
      }),
    }
  )
)


