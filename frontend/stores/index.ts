/**
 * Centralized store exports
 * Import stores from here for cleaner imports
 */

// Auth store - user session management
export { useAuthStore, type User } from './auth-store'

// Data stores
export { useEmployeesStore } from './employees-store'
export { useHomeStore } from './home-store'
export { useProjectsStore, useSelectedProject, selectSelectedProject } from './projects-store'
export { useUsersStore } from './users-store'

// Utilities
export * from './utils'

