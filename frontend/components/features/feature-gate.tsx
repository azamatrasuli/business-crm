'use client'

import { type ReactNode } from 'react'
import { isFeatureEnabled, type FeatureFlag, getBlockedReason } from '@/lib/features.config'
import { ComingSoonPage } from './coming-soon-page'

interface FeatureGateProps {
  /** Фича которую нужно проверить */
  feature: FeatureFlag
  /** Контент который показывать если фича включена */
  children: ReactNode
  /** Кастомный fallback (по умолчанию ComingSoonPage) */
  fallback?: ReactNode
  /** Полностью скрыть вместо fallback */
  hideIfDisabled?: boolean
}

/**
 * Компонент-обёртка для условного рендеринга по feature flag
 * 
 * @example
 * // Показать страницу или "Скоро"
 * <FeatureGate feature="compensation">
 *   <CompensationPage />
 * </FeatureGate>
 * 
 * @example
 * // Полностью скрыть если выключено
 * <FeatureGate feature="compensation" hideIfDisabled>
 *   <CompensationButton />
 * </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  hideIfDisabled = false 
}: FeatureGateProps) {
  const enabled = isFeatureEnabled(feature)
  
  if (enabled) {
    return <>{children}</>
  }
  
  if (hideIfDisabled) {
    return null
  }
  
  if (fallback) {
    return <>{fallback}</>
  }
  
  return <ComingSoonPage feature={feature} />
}

interface FeatureVisibleProps {
  /** Фича которую нужно проверить */
  feature: FeatureFlag
  /** Контент который показывать если фича включена */
  children: ReactNode
}

/**
 * Упрощённый компонент — просто скрывает контент если фича выключена
 * 
 * @example
 * <FeatureVisible feature="compensation">
 *   <Button>Управлять компенсациями</Button>
 * </FeatureVisible>
 */
export function FeatureVisible({ feature, children }: FeatureVisibleProps) {
  if (!isFeatureEnabled(feature)) {
    return null
  }
  return <>{children}</>
}

interface FeatureDisabledProps {
  /** Фича которую нужно проверить */
  feature: FeatureFlag
  /** Контент который показывать если фича ВЫКЛЮЧЕНА */
  children: ReactNode
}

/**
 * Обратный компонент — показывает контент только если фича ВЫКЛЮЧЕНА
 * Полезно для показа badge "Скоро" и т.п.
 * 
 * @example
 * <FeatureDisabled feature="compensation">
 *   <Badge>Скоро</Badge>
 * </FeatureDisabled>
 */
export function FeatureDisabled({ feature, children }: FeatureDisabledProps) {
  if (isFeatureEnabled(feature)) {
    return null
  }
  return <>{children}</>
}


