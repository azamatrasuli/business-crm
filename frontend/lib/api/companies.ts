import apiClient from './client'

export interface CompanyListItem {
  id: string
  name: string
  budget: number
  status: string
  projectsCount: number
  employeesCount: number
}

export interface CompanyResponse {
  id: string
  name: string
  budget: number
  overdraftLimit: number
  currencyCode: string
  timezone: string
  cutoffTime: string
  status: string
  createdAt: string
}

/**
 * Get all companies (SUPER_ADMIN only)
 */
export async function getAllCompanies(): Promise<CompanyListItem[]> {
  const response = await apiClient.get<CompanyListItem[]>('/companies')
  return response.data
}

/**
 * Get company by ID (SUPER_ADMIN only)
 */
export async function getCompanyById(id: string): Promise<CompanyResponse> {
  const response = await apiClient.get<CompanyResponse>(`/companies/${id}`)
  return response.data
}

