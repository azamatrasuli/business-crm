import apiClient from './client';

// Types
export interface Project {
  id: string;
  companyId: string;
  name: string;
  // Address (immutable after creation)
  addressName: string;
  addressFullAddress: string;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
  // Finance
  budget: number;
  overdraftLimit: number;
  currencyCode: string;
  status: 'ACTIVE' | 'BLOCKED_DEBT' | 'ARCHIVED';
  timezone: string;
  cutoffTime: string;
  serviceTypes: ('LUNCH' | 'COMPENSATION')[];
  compensationDailyLimit: number;
  compensationRollover: boolean;
  isHeadquarters: boolean;
  createdAt: string;
  updatedAt: string;
  employeesCount: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  // Address (immutable)
  addressName: string;
  addressFullAddress: string;
  // Finance
  budget: number;
  overdraftLimit?: number;
  currencyCode?: string;
  cutoffTime?: string;
  status: string;
  serviceTypes: string[];
  isHeadquarters: boolean;
  
  // Employee counts
  employeesCount: number;
  employeesWithLunch: number;
  employeesWithCompensation: number;
  
  // Spending breakdown
  spentLunch: number;
  spentCompensation: number;
  spentTotal: number;
  
  // Budget remaining
  budgetRemaining: number;
}

export interface ProjectStats {
  projectId: string;
  projectName: string;
  budget: number;
  totalSpent: number;
  activeEmployees: number;
  totalOrders: number;
  todayOrders: number;
}

export interface CreateProjectRequest {
  name: string;
  // Address (required, immutable after creation)
  addressName: string;
  addressFullAddress: string;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
  // Finance
  budget?: number;
  overdraftLimit?: number;
  currencyCode?: string;
  timezone?: string;
  cutoffTime?: string;
  serviceTypes?: ('LUNCH' | 'COMPENSATION')[];
  compensationDailyLimit?: number;
  compensationRollover?: boolean;
}

export interface UpdateProjectRequest {
  name?: string;
  // Address fields - can be updated to fill in missing data
  addressName?: string;
  addressFullAddress?: string;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
  // Finance & settings
  budget?: number;
  overdraftLimit?: number;
  currencyCode?: string;
  status?: 'ACTIVE' | 'BLOCKED_DEBT' | 'ARCHIVED';
  timezone?: string;
  cutoffTime?: string;
  serviceTypes?: ('LUNCH' | 'COMPENSATION')[];
  compensationDailyLimit?: number;
  compensationRollover?: boolean;
}

/**
 * Check if project has valid delivery address.
 * Projects without full address cannot have orders created.
 */
export function hasValidAddress(project: { addressFullAddress?: string | null }): boolean {
  return !!project.addressFullAddress && project.addressFullAddress.trim().length > 0;
}

/**
 * Check if project list item has valid delivery address.
 */
export function projectHasValidAddress(project: ProjectListItem | Project): boolean {
  return hasValidAddress(project);
}

// API calls
export async function getProjects(): Promise<ProjectListItem[]> {
  const response = await apiClient.get<ProjectListItem[]>('/projects');
  return response.data;
}

export async function getProject(id: string): Promise<Project> {
  const response = await apiClient.get<Project>(`/projects/${id}`);
  return response.data;
}

export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await apiClient.post<Project>('/projects', data);
  return response.data;
}

export async function updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
  const response = await apiClient.put<Project>(`/projects/${id}`, data);
  return response.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

export async function getProjectStats(id: string): Promise<ProjectStats> {
  const response = await apiClient.get<ProjectStats>(`/projects/${id}/stats`);
  return response.data;
}

export async function getServiceTypes(): Promise<{ value: string; label: string }[]> {
  const response = await apiClient.get<{ value: string; label: string }[]>('/projects/service-types');
  return response.data;
}
