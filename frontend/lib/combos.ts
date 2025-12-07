import type { ComboType } from './api/home'
import { config } from './config'

type ComboMeta = {
  icon: string
  title: string
  price: number
  features: string[]
}

// Цены из централизованного конфига
const { COMBO_25, COMBO_35 } = config.pricing.combos

export const COMBO_TYPES: ComboType[] = ['Комбо 25', 'Комбо 35']

export const COMBO_METADATA: Record<ComboType, ComboMeta> = {
  'Комбо 25': {
    icon: '🍲',
    title: `${COMBO_25.name} (${COMBO_25.price} сомони)`,
    price: COMBO_25.price,
    features: ['Второе блюдо', 'Салат', 'Хлеб + приборы'],
  },
  'Комбо 35': {
    icon: '🍱',
    title: `${COMBO_35.name} (${COMBO_35.price} сомони)`,
    price: COMBO_35.price,
    features: ['Первое блюдо', 'Второе блюдо', 'Салат', 'Хлеб + приборы'],
  },
}

export const getComboPrice = (combo: ComboType) => COMBO_METADATA[combo].price


