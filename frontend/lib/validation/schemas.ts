/**
 * @fileoverview Validation Schemas
 * Centralized validation schemas using Zod.
 * Based on Code Quality Audit Framework - Single Source of Truth.
 */

import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════════════════════
// Common Validation Patterns
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phone number regex pattern (UAE format)
 */
const PHONE_REGEX = /^\+?971\d{9}$|^0\d{9}$/

/**
 * Common error messages (Russian)
 */
export const ValidationMessages = {
  required: 'Обязательное поле',
  email: 'Введите корректный email',
  phone: 'Введите корректный телефон (формат: +971XXXXXXXXX)',
  minLength: (min: number) => `Минимум ${min} символов`,
  maxLength: (max: number) => `Максимум ${max} символов`,
  min: (min: number) => `Минимальное значение: ${min}`,
  max: (max: number) => `Максимальное значение: ${max}`,
  positive: 'Значение должно быть положительным',
  integer: 'Значение должно быть целым числом',
  password: 'Пароль должен содержать минимум 8 символов, заглавную букву и цифру',
  passwordMatch: 'Пароли не совпадают',
  date: 'Введите корректную дату',
  futureDate: 'Дата должна быть в будущем',
  pastDate: 'Дата должна быть в прошлом',
  url: 'Введите корректный URL',
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// Base Field Schemas
// ═══════════════════════════════════════════════════════════════════════════════

/** Required string that's not empty */
export const requiredString = z.string().min(1, ValidationMessages.required)

/** Optional string */
export const optionalString = z.string().optional()

/** Email field */
export const emailField = z.string().email(ValidationMessages.email)

/** Phone field (UAE format) */
export const phoneField = z.string().regex(PHONE_REGEX, ValidationMessages.phone)

/** Password field with requirements */
export const passwordField = z
  .string()
  .min(8, ValidationMessages.minLength(8))
  .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
  .regex(/[0-9]/, 'Пароль должен содержать цифру')

/** Positive integer */
export const positiveInteger = z.number().int(ValidationMessages.integer).positive(ValidationMessages.positive)

/** Non-negative number */
export const nonNegativeNumber = z.number().min(0, ValidationMessages.positive)

/** UUID field */
export const uuidField = z.string().uuid('Некорректный идентификатор')

// ═══════════════════════════════════════════════════════════════════════════════
// Auth Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const loginSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, ValidationMessages.required),
})

export const forgotPasswordSchema = z.object({
  phone: phoneField,
})

export const resetPasswordSchema = z
  .object({
    token: requiredString,
    password: passwordField,
    confirmPassword: requiredString,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: ValidationMessages.passwordMatch,
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: requiredString,
    newPassword: passwordField,
    confirmPassword: requiredString,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: ValidationMessages.passwordMatch,
    path: ['confirmPassword'],
  })

// ═══════════════════════════════════════════════════════════════════════════════
// Employee Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const createEmployeeSchema = z.object({
  firstName: requiredString.max(50, ValidationMessages.maxLength(50)),
  lastName: requiredString.max(50, ValidationMessages.maxLength(50)),
  phone: phoneField,
  projectId: uuidField.optional(),
  serviceType: z.enum(['LUNCH', 'COMPENSATION']),
  shiftType: z.enum(['DAY', 'NIGHT']).optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

// ═══════════════════════════════════════════════════════════════════════════════
// User Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const createUserSchema = z.object({
  name: requiredString.max(100, ValidationMessages.maxLength(100)),
  phone: phoneField,
  email: emailField.optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'OPERATOR']),
  password: passwordField,
})

export const updateUserSchema = createUserSchema.omit({ password: true }).partial()

// ═══════════════════════════════════════════════════════════════════════════════
// Project Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const createProjectSchema = z.object({
  name: requiredString.max(100, ValidationMessages.maxLength(100)),
  address: requiredString.max(255, ValidationMessages.maxLength(255)),
  timezone: requiredString,
})

export const updateProjectSchema = createProjectSchema.omit({ address: true }).partial()

// ═══════════════════════════════════════════════════════════════════════════════
// Order/Subscription Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const assignMealsSchema = z.object({
  orderIds: z.array(uuidField).min(1, 'Выберите хотя бы один заказ'),
  mealId: uuidField.optional(),
  comboType: z.string().optional(),
})

export const createGuestOrderSchema = z.object({
  date: z.string().min(1, ValidationMessages.required),
  employeeName: requiredString.max(100, ValidationMessages.maxLength(100)),
  comboType: z.enum(['Комбо 25', 'Комбо 35']),
  projectId: uuidField.optional(),
})

export const updateSubscriptionSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['Активен', 'На паузе', 'Завершен']).optional(),
  comboType: z.string().optional(),
})

export const bulkUpdateSubscriptionSchema = z.object({
  employeeIds: z.array(uuidField).min(1, 'Выберите хотя бы одного сотрудника'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['Активен', 'На паузе', 'Завершен']).optional(),
})

// ═══════════════════════════════════════════════════════════════════════════════
// Compensation Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const compensationSchema = z.object({
  amount: nonNegativeNumber,
  period: z.enum(['в День', 'в Неделю', 'в Месяц']),
})

// ═══════════════════════════════════════════════════════════════════════════════
// Type Exports
// ═══════════════════════════════════════════════════════════════════════════════

export type LoginFormData = z.infer<typeof loginSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
export type CreateProjectFormData = z.infer<typeof createProjectSchema>
export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>
export type AssignMealsFormData = z.infer<typeof assignMealsSchema>
export type CreateGuestOrderFormData = z.infer<typeof createGuestOrderSchema>
export type UpdateSubscriptionFormData = z.infer<typeof updateSubscriptionSchema>
export type BulkUpdateSubscriptionFormData = z.infer<typeof bulkUpdateSubscriptionSchema>
export type CompensationFormData = z.infer<typeof compensationSchema>

