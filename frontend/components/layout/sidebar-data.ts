"use client"

import {
  LayoutDashboard,
  Users,
  User,
  CreditCard,
  TrendingUp,
  Newspaper,
  MapPin,
  FolderKanban,
} from 'lucide-react'
import type { FeatureFlag } from '@/lib/features.config'

export interface MenuItem {
  icon: typeof LayoutDashboard
  label: string
  href: string
  permission: string
  /** Feature flag — если указан и выключен, пункт показывается как "Скоро" */
  feature?: FeatureFlag
}

export const menuItems: MenuItem[] = [
  // MVP Features (всегда доступны)
  { icon: LayoutDashboard, label: 'Админ панель', href: '/', permission: 'home' },
  { icon: FolderKanban, label: 'Проекты', href: '/projects', permission: 'projects' },
  { icon: User, label: 'Сотрудники', href: '/employees', permission: 'employees' },
  // Phase 2 Features (заблокированы в production)
  { icon: Users, label: 'Пользователи', href: '/users', permission: 'users', feature: 'users' },
  { icon: CreditCard, label: 'Оплаты', href: '/payments', permission: 'payments', feature: 'payments' },
  { icon: TrendingUp, label: 'Аналитика', href: '/analytics', permission: 'analytics', feature: 'analytics' },
  { icon: Newspaper, label: 'Новости', href: '/news', permission: 'news', feature: 'news' },
  { icon: MapPin, label: 'Партнеры', href: '/partners', permission: 'partners', feature: 'partners' },
]


