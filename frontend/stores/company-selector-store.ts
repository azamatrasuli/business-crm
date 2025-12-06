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
  
  // Check if viewing another company (read-only mode)
  isViewingOtherCompany: (userCompanyId: string | null) => boolean
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
        })
        // Reload page to refresh all data with original company
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
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
      },
      
      isViewingOtherCompany: (userCompanyId: string | null) => {
        const { selectedCompanyId } = get()
        // If no selected company or no user company, not viewing other
        if (!selectedCompanyId || !userCompanyId) return false
        // If selected company is different from user's company
        return selectedCompanyId !== userCompanyId
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


