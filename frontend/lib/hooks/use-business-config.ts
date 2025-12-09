/**
 * @fileoverview Business Config Hook
 * 
 * Loads business configuration from backend API with React Query.
 * Falls back to static config if API fails.
 * 
 * Usage:
 *   const { config, isLoading } = useBusinessConfig()
 *   console.log(config.subscription.minDays) // 5 (from DB)
 */

import { useQuery } from '@tanstack/react-query'
import { BusinessConfigResponse, fetchBusinessConfig } from '../api/config'
import { config as staticConfig } from '../config'

// Query key for React Query
export const BUSINESS_CONFIG_KEY = ['business-config']

// Default config (fallback if API fails)
const DEFAULT_CONFIG: BusinessConfigResponse = {
  subscription: {
    minDays: staticConfig.business.subscriptions.minDays,
    maxFreezesPerWeek: staticConfig.business.freezes.maxPerWeek,
  },
  order: {
    cutoffOffsetHours: 0,
  },
  budget: {
    allowOverdraft: true,
  },
  combo: {
    prices: {
      STANDARD: staticConfig.pricing.combos.COMBO_25.price,
      PREMIUM: staticConfig.pricing.combos.COMBO_35.price,
      DIET: 30,
    },
  },
}

/**
 * Hook to fetch and cache business configuration.
 * 
 * @example
 * const { config, isLoading, error } = useBusinessConfig()
 * 
 * // Use config values
 * if (days < config.subscription.minDays) {
 *   showError(`Минимум ${config.subscription.minDays} дней`)
 * }
 */
export function useBusinessConfig() {
  const query = useQuery({
    queryKey: BUSINESS_CONFIG_KEY,
    queryFn: fetchBusinessConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes (match backend cache)
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    // Return default config on error
    placeholderData: DEFAULT_CONFIG,
  })

  return {
    config: query.data ?? DEFAULT_CONFIG,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Get specific config value with type safety.
 */
export function useConfigValue<K extends keyof BusinessConfigResponse>(
  key: K
): BusinessConfigResponse[K] {
  const { config } = useBusinessConfig()
  return config[key]
}

/**
 * Hook for subscription-specific config values.
 */
export function useSubscriptionConfig() {
  const { config } = useBusinessConfig()
  return config.subscription
}

/**
 * Hook for combo prices.
 */
export function useComboPrices() {
  const { config } = useBusinessConfig()
  return {
    'Комбо 25': config.combo.prices.STANDARD,
    'Комбо 35': config.combo.prices.PREMIUM,
  }
}

