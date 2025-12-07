/**
 * @fileoverview Compound Wizard Component
 * Flexible multi-step wizard using compound components pattern.
 */

'use client'

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { Button } from './button'
import { Progress } from './progress'
import { cn } from '@/lib/utils'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardContextType {
  step: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  canProceed: boolean
  setCanProceed: (can: boolean) => void
  next: () => void
  prev: () => void
  goTo: (step: number) => void
  data: Record<string, unknown>
  setData: (key: string, value: unknown) => void
}

const WizardContext = createContext<WizardContextType | null>(null)

function useWizardContext() {
  const context = useContext(WizardContext)
  if (!context) {
    throw new Error('Wizard components must be used within Wizard.Root')
  }
  return context
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root Component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardRootProps {
  children: ReactNode
  totalSteps: number
  initialStep?: number
  onStepChange?: (step: number) => void
  onComplete?: (data: Record<string, unknown>) => void
  className?: string
}

function WizardRoot({
  children,
  totalSteps,
  initialStep = 0,
  onStepChange,
  onComplete,
  className,
}: WizardRootProps) {
  const [step, setStep] = useState(initialStep)
  const [canProceed, setCanProceed] = useState(true)
  const [data, setDataState] = useState<Record<string, unknown>>({})

  const isFirstStep = step === 0
  const isLastStep = step === totalSteps - 1

  const goTo = useCallback(
    (newStep: number) => {
      if (newStep >= 0 && newStep < totalSteps) {
        setStep(newStep)
        onStepChange?.(newStep)
      }
    },
    [totalSteps, onStepChange]
  )

  const next = useCallback(() => {
    if (canProceed) {
      if (isLastStep) {
        onComplete?.(data)
      } else {
        goTo(step + 1)
      }
    }
  }, [canProceed, isLastStep, goTo, step, onComplete, data])

  const prev = useCallback(() => {
    if (!isFirstStep) {
      goTo(step - 1)
    }
  }, [isFirstStep, goTo, step])

  const setData = useCallback((key: string, value: unknown) => {
    setDataState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const value = useMemo(
    () => ({
      step,
      totalSteps,
      isFirstStep,
      isLastStep,
      canProceed,
      setCanProceed,
      next,
      prev,
      goTo,
      data,
      setData,
    }),
    [step, totalSteps, isFirstStep, isLastStep, canProceed, next, prev, goTo, data, setData]
  )

  return (
    <WizardContext.Provider value={value}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </WizardContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Step Component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardStepProps {
  index: number
  children: ReactNode
  className?: string
}

function WizardStep({ index, children, className }: WizardStepProps) {
  const { step } = useWizardContext()

  if (step !== index) return null

  return <div className={cn('flex-1', className)}>{children}</div>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Progress Component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardProgressProps {
  className?: string
  showPercentage?: boolean
}

function WizardProgress({ className, showPercentage }: WizardProgressProps) {
  const { step, totalSteps } = useWizardContext()
  const percentage = ((step + 1) / totalSteps) * 100

  return (
    <div className={cn('space-y-2', className)}>
      <Progress value={percentage} className="h-2" />
      {showPercentage && (
        <p className="text-xs text-muted-foreground text-center">
          Шаг {step + 1} из {totalSteps}
        </p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Steps Indicator Component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardStepsIndicatorProps {
  labels?: string[]
  className?: string
}

function WizardStepsIndicator({ labels = [], className }: WizardStepsIndicatorProps) {
  const { step, totalSteps, goTo } = useWizardContext()

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < step
        const isCurrent = index === step
        const label = labels[index]

        return (
          <div key={index} className="flex items-center">
            <button
              type="button"
              onClick={() => isCompleted && goTo(index)}
              disabled={!isCompleted}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                isCompleted && 'bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90',
                isCurrent && 'bg-primary text-primary-foreground',
                !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
            </button>
            {label && (
              <span
                className={cn(
                  'ml-2 text-sm hidden sm:inline',
                  isCurrent ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            )}
            {index < totalSteps - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-2',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Navigation Component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardNavigationProps {
  className?: string
  prevLabel?: string
  nextLabel?: string
  completeLabel?: string
  showPrev?: boolean
  isLoading?: boolean
}

function WizardNavigation({
  className,
  prevLabel = 'Назад',
  nextLabel = 'Далее',
  completeLabel = 'Завершить',
  showPrev = true,
  isLoading = false,
}: WizardNavigationProps) {
  const { isFirstStep, isLastStep, canProceed, next, prev } = useWizardContext()

  return (
    <div className={cn('flex justify-between gap-4', className)}>
      {showPrev && !isFirstStep ? (
        <Button type="button" variant="outline" onClick={prev} disabled={isLoading}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          {prevLabel}
        </Button>
      ) : (
        <div />
      )}
      <Button
        type="button"
        onClick={next}
        disabled={!canProceed || isLoading}
      >
        {isLastStep ? completeLabel : nextLabel}
        {!isLastStep && <ChevronRight className="h-4 w-4 ml-2" />}
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Header Component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardHeaderProps {
  titles?: string[]
  descriptions?: string[]
  className?: string
}

function WizardHeader({ titles = [], descriptions = [], className }: WizardHeaderProps) {
  const { step } = useWizardContext()
  const title = titles[step]
  const description = descriptions[step]

  if (!title && !description) return null

  return (
    <div className={cn('space-y-1', className)}>
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook for step validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to control wizard step validation
 *
 * @example
 * function StepOne() {
 *   const [value, setValue] = useState('')
 *   useWizardStep(value.length > 0)
 *   return <Input value={value} onChange={e => setValue(e.target.value)} />
 * }
 */
export function useWizardStep(isValid: boolean) {
  const { setCanProceed } = useWizardContext()

  // Update canProceed when isValid changes
  useMemo(() => {
    setCanProceed(isValid)
  }, [isValid, setCanProceed])
}

/**
 * Hook to access wizard data
 */
export function useWizardData<T = Record<string, unknown>>() {
  const { data, setData } = useWizardContext()
  return { data: data as T, setData }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export as namespace
// ═══════════════════════════════════════════════════════════════════════════════

export const Wizard = {
  Root: WizardRoot,
  Step: WizardStep,
  Progress: WizardProgress,
  StepsIndicator: WizardStepsIndicator,
  Navigation: WizardNavigation,
  Header: WizardHeader,
}

