import type { ComboType } from './api/home'

type ComboMeta = {
  icon: string
  title: string
  price: number
  features: string[]
}

export const COMBO_TYPES: ComboType[] = ['Комбо 25', 'Комбо 35']

export const COMBO_METADATA: Record<ComboType, ComboMeta> = {
  'Комбо 25': {
    icon: '🍲',
    title: 'Комбо 25 (25 сомони)',
    price: 25,
    features: ['Второе блюдо', 'Салат', 'Хлеб + приборы'],
  },
  'Комбо 35': {
    icon: '🍱',
    title: 'Комбо 35 (35 сомони)',
    price: 35,
    features: ['Первое блюдо', 'Второе блюдо', 'Салат', 'Хлеб + приборы'],
  },
}

export const getComboPrice = (combo: ComboType) => COMBO_METADATA[combo].price


