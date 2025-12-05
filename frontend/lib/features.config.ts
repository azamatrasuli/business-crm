/**
 * Feature Flags Configuration
 * 
 * Управляет доступностью функционала в зависимости от окружения.
 * В production — только MVP фичи.
 * В staging/development — все фичи включены.
 * 
 * @see RELEASE_PROGRESS.md для деталей релиза
 */

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
  | 'payments'          // Оплаты / Инвойсы
  | 'analytics'         // Аналитика
  | 'news'              // Новости
  | 'partners'          // Партнёры / Рестораны

/**
 * Production features — только MVP
 */
const PRODUCTION_FEATURES: Record<FeatureFlag, boolean> = {
  // MVP - включено
  auth: true,
  projects: true,
  users: true,
  employees: true,
  lunch: true,
  dashboard: true,
  guestOrders: true,
  // Phase 2 - заблокировано
  compensation: false,
  payments: false,
  analytics: false,
  news: false,
  partners: false,
}

/**
 * Development/Staging features — всё включено
 */
const DEVELOPMENT_FEATURES: Record<FeatureFlag, boolean> = {
  auth: true,
  projects: true,
  users: true,
  employees: true,
  lunch: true,
  dashboard: true,
  guestOrders: true,
  compensation: true,
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
    compensation: 'Компенсации будут доступны после запуска Client Web',
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
    'dashboard', 'guestOrders', 'compensation', 'payments', 
    'analytics', 'news', 'partners'
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
  '/users': null, // users в MVP
  '/employees': null, // employees в MVP
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

