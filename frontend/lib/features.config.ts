/**
 * Feature Flags Configuration
 * 
 * Управляет доступностью функционала в зависимости от окружения.
 * В production — только MVP фичи (берутся из /config.json).
 * В staging/development — все фичи включены.
 */

import { FEATURES } from './config'

export type FeatureFlag = 
  // MVP Features (enabled in production)
  | 'auth'              // Авторизация
  | 'projects'          // Проекты (филиалы)
  | 'users'             // Пользователи B2B кабинета
  | 'employees'         // Сотрудники
  | 'lunch'             // Подписки на обеды
  | 'dashboard'         // Dashboard с заказами
  | 'guestOrders'       // Гостевые заказы
  // Phase 2 Features (blocked in production)
  | 'compensation'      // Компенсации на питание
  | 'passwordReset'     // Сброс пароля
  | 'payments'          // Оплаты / Инвойсы
  | 'analytics'         // Аналитика
  | 'news'              // Новости
  | 'partners'          // Партнёры / Рестораны

/**
 * Production features — из config.json
 */
const PRODUCTION_FEATURES: Record<FeatureFlag, boolean> = {
  // MVP - всегда включено
  auth: true,
  projects: true,
  users: false, // Скрыто для production - Phase 2
  employees: true,
  dashboard: true,
  guestOrders: true,
  // Из config.json
  lunch: FEATURES.lunch,
  compensation: FEATURES.compensation,
  passwordReset: FEATURES.passwordReset,
  payments: FEATURES.payments,
  analytics: FEATURES.analytics,
  news: FEATURES.news,
  partners: FEATURES.partners,
}

/**
 * Development/Staging features — всё включено (кроме compensation - не готово)
 */
const DEVELOPMENT_FEATURES: Record<FeatureFlag, boolean> = {
  auth: true,
  projects: true,
  users: true,
  employees: true,
  lunch: true,
  dashboard: true,
  guestOrders: true,
  compensation: false, // DISABLED: Компенсации не готовы
  passwordReset: true,
  payments: true,
  analytics: true,
  news: true,
  partners: true,
}

/**
 * Текущее окружение
 */
export type AppEnvironment = 'production' | 'staging' | 'development'

export const getAppEnvironment = (): AppEnvironment => {
  const env = process.env.NEXT_PUBLIC_APP_ENV
  if (env === 'production') return 'production'
  if (env === 'staging') return 'staging'
  return 'development'
}

/**
 * Проверить включена ли фича
 */
export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  const env = getAppEnvironment()
  const features = env === 'production' ? PRODUCTION_FEATURES : DEVELOPMENT_FEATURES
  return features[feature] ?? false
}

/**
 * Получить причину блокировки фичи (для UI)
 */
export const getBlockedReason = (feature: FeatureFlag): string | null => {
  if (isFeatureEnabled(feature)) return null
  
  const reasons: Partial<Record<FeatureFlag, string>> = {
    users: 'Управление пользователями будет доступно в следующем обновлении',
    compensation: 'Компенсации будут доступны после запуска Client Web',
    passwordReset: 'Сброс пароля будет доступен в следующем обновлении',
    payments: 'Раздел оплат находится в разработке',
    analytics: 'Аналитика будет доступна в следующем обновлении',
    news: 'Новости будут доступны в следующем обновлении',
    partners: 'Карта партнёров будет доступна в следующем обновлении',
  }
  
  return reasons[feature] || 'Функционал будет доступен в следующем обновлении'
}

/**
 * Получить список всех заблокированных фич
 */
export const getBlockedFeatures = (): FeatureFlag[] => {
  const allFeatures: FeatureFlag[] = [
    'auth', 'projects', 'users', 'employees', 'lunch', 
    'dashboard', 'guestOrders', 'compensation', 'passwordReset',
    'payments', 'analytics', 'news', 'partners'
  ]
  return allFeatures.filter(f => !isFeatureEnabled(f))
}

/**
 * Маппинг фичи на роут
 */
export const featureToRoute: Partial<Record<FeatureFlag, string>> = {
  dashboard: '/',
  projects: '/projects',
  users: '/users',
  employees: '/employees',
  payments: '/payments',
  analytics: '/analytics',
  news: '/news',
  partners: '/partners',
}

/**
 * Маппинг роута на фичу
 */
export const routeToFeature: Record<string, FeatureFlag | null> = {
  '/': null, // dashboard всегда доступен
  '/projects': null, // projects в MVP
  '/users': 'users', // скрыто для production
  '/employees': null, // employees в MVP
  '/forgot-password': 'passwordReset',
  '/reset-password': 'passwordReset',
  '/payments': 'payments',
  '/analytics': 'analytics', 
  '/news': 'news',
  '/partners': 'partners',
  '/profile': null, // profile всегда доступен
}

/**
 * Проверить доступен ли роут
 */
export const isRouteEnabled = (pathname: string): boolean => {
  const feature = routeToFeature[pathname]
  if (feature === null || feature === undefined) return true
  return isFeatureEnabled(feature)
}

