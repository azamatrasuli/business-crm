'use client'

import { 
  Clock, 
  Sparkles, 
  CreditCard, 
  TrendingUp, 
  Newspaper, 
  MapPin,
  Wallet,
  ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type FeatureFlag, getBlockedReason } from '@/lib/features.config'
import Link from 'next/link'

interface ComingSoonPageProps {
  feature: FeatureFlag
}

const featureInfo: Record<string, { 
  title: string
  description: string
  icon: typeof Clock
  color: string
}> = {
  compensation: {
    title: 'Компенсации',
    description: 'Система компенсаций на питание с QR-оплатой в партнёрских ресторанах',
    icon: Wallet,
    color: 'text-emerald-500',
  },
  payments: {
    title: 'Оплаты',
    description: 'Управление счетами и инвойсами от Yalla Lunch',
    icon: CreditCard,
    color: 'text-blue-500',
  },
  analytics: {
    title: 'Аналитика',
    description: 'Подробные графики и отчёты по расходам компании',
    icon: TrendingUp,
    color: 'text-purple-500',
  },
  news: {
    title: 'Новости',
    description: 'Обновления и документы от Yalla Lunch',
    icon: Newspaper,
    color: 'text-orange-500',
  },
  partners: {
    title: 'Партнёры',
    description: 'Карта и список ресторанов-партнёров',
    icon: MapPin,
    color: 'text-red-500',
  },
}

export function ComingSoonPage({ feature }: ComingSoonPageProps) {
  const info = featureInfo[feature] || {
    title: 'Раздел',
    description: 'Этот функционал находится в разработке',
    icon: Clock,
    color: 'text-gray-500',
  }
  
  const Icon = info.icon
  const reason = getBlockedReason(feature)
  
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 border-dashed">
        <CardContent className="pt-12 pb-10 px-8 text-center">
          {/* Animated Icon */}
          <div className="relative mx-auto w-24 h-24 mb-8">
            <div className={`absolute inset-0 rounded-full ${info.color} opacity-10 animate-ping`} />
            <div className={`relative flex items-center justify-center w-full h-full rounded-full bg-muted`}>
              <Icon className={`w-12 h-12 ${info.color}`} />
            </div>
          </div>
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Скоро
          </div>
          
          {/* Title */}
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            {info.title}
          </h1>
          
          {/* Description */}
          <p className="text-muted-foreground text-lg mb-4">
            {info.description}
          </p>
          
          {/* Reason */}
          {reason && (
            <p className="text-sm text-muted-foreground/80 mb-8">
              {reason}
            </p>
          )}
          
          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-border" />
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 h-px bg-border" />
          </div>
          
          {/* Info */}
          <p className="text-sm text-muted-foreground mb-6">
            Мы работаем над этим разделом и скоро он станет доступен.
            <br />
            Следите за обновлениями!
          </p>
          
          {/* Back Button */}
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться на главную
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


