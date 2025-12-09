/**
 * @fileoverview Business Config API Client
 * 
 * Fetches business configuration from backend API.
 * Backend is the SINGLE SOURCE OF TRUTH for all business rules.
 * 
 * This replaces hardcoded values in config.json with dynamic values from DB.
 */

import apiClient from './client'

// =============================================================================
// Types (match backend response)
// =============================================================================

export interface BusinessConfigResponse {
  subscription: {
    minDays: number
    maxFreezesPerWeek: number
  }
  order: {
    cutoffOffsetHours: number
  }
  budget: {
    allowOverdraft: boolean
  }
  combo: {
    prices: {
      STANDARD: number
      PREMIUM: number
      DIET: number
    }
  }
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch business configuration from backend.
 * This endpoint is public and cached for 5 minutes.
 */
export async function fetchBusinessConfig(): Promise<BusinessConfigResponse> {
  const response = await apiClient.get<BusinessConfigResponse>('/config')
  return response.data
}

/**
 * Get raw config values (admin only)
 */
export async function fetchRawConfig(): Promise<Record<string, unknown>> {
  const response = await apiClient.get<Record<string, unknown>>('/config/raw')
  return response.data
}

/**
 * Update config value (admin only)
 */
export async function updateConfig(key: string, value: unknown): Promise<void> {
  await apiClient.put(`/config/${encodeURIComponent(key)}`, { value })
}

/**
 * Clear config cache (admin only)
 */
export async function clearConfigCache(): Promise<void> {
  await apiClient.post('/config/clear-cache')
}

