'use client'

import * as React from 'react'
import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Filter, Plus, X, ChevronDown, Trash2 } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { formatISODate } from '@/lib/utils/date'

// Filter types
export type FilterOperator = 
  | 'equals' 
  | 'contains' 
  | 'gte' 
  | 'lte' 
  | 'between' 
  | 'is_true' 
  | 'is_false'
  | 'is_set'
  | 'is_not_set'

export type FilterValueType = 'text' | 'number' | 'select' | 'boolean' | 'date'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterField {
  id: string
  label: string
  type: FilterValueType
  operators: FilterOperator[]
  options?: FilterOption[] // for select type
  placeholder?: string
}

export interface ActiveFilter {
  id: string
  fieldId: string
  operator: FilterOperator
  value: string | number | [number, number] | boolean | null
}

interface FilterBuilderProps {
  fields: FilterField[]
  activeFilters: ActiveFilter[]
  onFiltersChange: (filters: ActiveFilter[]) => void
  className?: string
  triggerClassName?: string
}

const operatorLabels: Record<FilterOperator, string> = {
  equals: 'равно',
  contains: 'содержит',
  gte: 'от',
  lte: 'до',
  between: 'между',
  is_true: 'да',
  is_false: 'нет',
  is_set: 'указано',
  is_not_set: 'не указано',
}

const getDefaultOperator = (type: FilterValueType): FilterOperator => {
  switch (type) {
    case 'text':
      return 'contains'
    case 'number':
      return 'gte'
    case 'select':
      return 'equals'
    case 'boolean':
      return 'is_true'
    case 'date':
      return 'equals'
    default:
      return 'equals'
  }
}

const generateFilterId = () => Math.random().toString(36).substring(2, 9)

export function FilterBuilder({
  fields,
  activeFilters,
  onFiltersChange,
  className,
  triggerClassName,
}: FilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingFilter, setPendingFilter] = useState<Partial<ActiveFilter> | null>(null)

  const activeFilterCount = activeFilters.length

  const getFieldById = useCallback(
    (fieldId: string) => fields.find((f) => f.id === fieldId),
    [fields]
  )

  const handleAddFilter = useCallback(() => {
    if (fields.length === 0) return
    const firstField = fields[0]
    setPendingFilter({
      id: generateFilterId(),
      fieldId: firstField.id,
      operator: getDefaultOperator(firstField.type),
      value: null,
    })
  }, [fields])

  const handleFieldChange = useCallback(
    (fieldId: string) => {
      const field = getFieldById(fieldId)
      if (!field) return
      setPendingFilter((prev) => ({
        ...prev,
        fieldId,
        operator: getDefaultOperator(field.type),
        value: null,
      }))
    },
    [getFieldById]
  )

  const handleOperatorChange = useCallback((operator: FilterOperator) => {
    setPendingFilter((prev) => ({
      ...prev,
      operator,
      value: operator === 'between' ? [0, 0] : null,
    }))
  }, [])

  const handleValueChange = useCallback((value: string | number | boolean | null) => {
    setPendingFilter((prev) => ({
      ...prev,
      value,
    }))
  }, [])

  const handleBetweenValueChange = useCallback((index: 0 | 1, value: number) => {
    setPendingFilter((prev) => {
      const currentValue = (prev?.value as [number, number]) || [0, 0]
      const newValue: [number, number] = [...currentValue]
      newValue[index] = value
      return {
        ...prev,
        value: newValue,
      }
    })
  }, [])

  const handleApplyFilter = useCallback(() => {
    if (!pendingFilter?.fieldId || !pendingFilter.operator) return
    
    const field = getFieldById(pendingFilter.fieldId)
    if (!field) return

    // For boolean operators, no value is needed
    const isBooleanOperator = ['is_true', 'is_false', 'is_set', 'is_not_set'].includes(pendingFilter.operator)
    
    if (!isBooleanOperator && pendingFilter.value === null) return

    const newFilter: ActiveFilter = {
      id: pendingFilter.id || generateFilterId(),
      fieldId: pendingFilter.fieldId,
      operator: pendingFilter.operator,
      value: isBooleanOperator ? null : pendingFilter.value ?? null,
    }

    onFiltersChange([...activeFilters, newFilter])
    setPendingFilter(null)
  }, [pendingFilter, activeFilters, onFiltersChange, getFieldById])

  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      onFiltersChange(activeFilters.filter((f) => f.id !== filterId))
    },
    [activeFilters, onFiltersChange]
  )

  const handleClearAllFilters = useCallback(() => {
    onFiltersChange([])
    setPendingFilter(null)
  }, [onFiltersChange])

  const handleCancelPending = useCallback(() => {
    setPendingFilter(null)
  }, [])

  const formatFilterValue = useCallback(
    (filter: ActiveFilter) => {
      const field = getFieldById(filter.fieldId)
      if (!field) return ''

      if (['is_true', 'is_false', 'is_set', 'is_not_set'].includes(filter.operator)) {
        return operatorLabels[filter.operator]
      }

      if (filter.operator === 'between' && Array.isArray(filter.value)) {
        return `${filter.value[0]} — ${filter.value[1]}`
      }

      if (field.type === 'select' && field.options) {
        const option = field.options.find((o) => o.value === filter.value)
        return option?.label || String(filter.value)
      }

      return String(filter.value ?? '')
    },
    [getFieldById]
  )

  const renderValueInput = useMemo(() => {
    if (!pendingFilter?.fieldId) return null
    
    const field = getFieldById(pendingFilter.fieldId)
    if (!field) return null

    const { operator } = pendingFilter

    // Boolean operators don't need value input
    if (['is_true', 'is_false', 'is_set', 'is_not_set'].includes(operator || '')) {
      return null
    }

    if (field.type === 'select' && field.options) {
      return (
        <Select
          value={String(pendingFilter.value ?? '')}
          onValueChange={(value) => handleValueChange(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите значение" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (field.type === 'number') {
      if (operator === 'between') {
        const [min, max] = (pendingFilter.value as [number, number]) || [0, 0]
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="От"
              value={min || ''}
              onChange={(e) => handleBetweenValueChange(0, Number(e.target.value))}
              className="w-24"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="До"
              value={max || ''}
              onChange={(e) => handleBetweenValueChange(1, Number(e.target.value))}
              className="w-24"
            />
          </div>
        )
      }
      return (
        <Input
          type="number"
          placeholder={field.placeholder || 'Введите число'}
          value={pendingFilter.value as number || ''}
          onChange={(e) => handleValueChange(Number(e.target.value))}
          className="w-full"
        />
      )
    }

    if (field.type === 'date') {
      const dateValue = pendingFilter.value ? new Date(pendingFilter.value as string) : undefined
      return (
        <DatePicker
          value={dateValue}
          onChange={(date) => handleValueChange(date ? formatISODate(date) : null)}
          className="w-full"
        />
      )
    }

    // Default text input
    return (
      <Input
        type="text"
        placeholder={field.placeholder || 'Введите значение'}
        value={String(pendingFilter.value ?? '')}
        onChange={(e) => handleValueChange(e.target.value)}
        className="w-full"
      />
    )
  }, [pendingFilter, getFieldById, handleValueChange, handleBetweenValueChange])

  const currentField = pendingFilter?.fieldId ? getFieldById(pendingFilter.fieldId) : null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Active Filter Chips */}
      {activeFilters.map((filter) => {
        const field = getFieldById(filter.fieldId)
        if (!field) return null
        return (
          <Badge
            key={filter.id}
            variant="secondary"
            className="gap-1.5 pl-2.5 pr-1.5 py-1.5 text-sm font-normal bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
          >
            <span className="font-medium">{field.label}:</span>
            <span className="opacity-80">
              {filter.operator !== 'equals' && filter.operator !== 'contains' && !['is_true', 'is_false', 'is_set', 'is_not_set'].includes(filter.operator) && (
                <span className="mr-1">{operatorLabels[filter.operator]}</span>
              )}
              {formatFilterValue(filter)}
            </span>
            <button
              type="button"
              onClick={() => handleRemoveFilter(filter.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        )
      })}

      {/* Filter Button with Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-1.5 border-dashed',
              activeFilterCount > 0 && 'border-primary/50 bg-primary/5',
              triggerClassName
            )}
          >
            <Filter className="h-4 w-4" />
            Фильтры
            {activeFilterCount > 0 && (
              <Badge
                variant="default"
                className="ml-1 h-5 min-w-5 px-1.5 text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[360px] p-4" 
          align="start"
          sideOffset={8}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Фильтры</h4>
              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllFilters}
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Сбросить все
                </Button>
              )}
            </div>

            {/* Active Filters List */}
            {activeFilters.length > 0 && (
              <div className="space-y-2">
                {activeFilters.map((filter) => {
                  const field = getFieldById(filter.fieldId)
                  if (!field) return null
                  return (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <span className="font-medium shrink-0">{field.label}</span>
                        <span className="text-muted-foreground shrink-0">
                          {operatorLabels[filter.operator]}
                        </span>
                        <span className="truncate">
                          {formatFilterValue(filter)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleRemoveFilter(filter.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add New Filter Form */}
            {pendingFilter ? (
              <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                <div className="grid gap-2">
                  {/* Field Selection */}
                  <Select
                    value={pendingFilter.fieldId}
                    onValueChange={handleFieldChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите поле" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator Selection */}
                  {currentField && currentField.operators.length > 1 && (
                    <Select
                      value={pendingFilter.operator}
                      onValueChange={(value) => handleOperatorChange(value as FilterOperator)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Условие" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentField.operators.map((op) => (
                          <SelectItem key={op} value={op}>
                            {operatorLabels[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Value Input */}
                  {renderValueInput}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleApplyFilter}
                    className="flex-1"
                  >
                    Применить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelPending}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFilter}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Добавить фильтр
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear All Button (outside popover) */}
      {activeFilters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAllFilters}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Сбросить
        </Button>
      )}
    </div>
  )
}

