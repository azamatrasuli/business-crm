/**
 * Store utilities - centralized exports
 */

export { getErrorMessage, parseApiError, type ApiError } from './error-handler'
export {
  setAuthStatusCookie,
  clearAuthStatusCookie,
  hasAuthStatusCookie,
  getCookie,
} from './cookie-manager'
export {
  createDataStore,
  createInitialDataState,
  type DataStoreState,
  type DataStoreActions,
  type DataStoreApi,
  type PaginationState,
  type AsyncState,
} from './create-data-store'

