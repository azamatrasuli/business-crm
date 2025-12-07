/**
 * @fileoverview UI Stores barrel export
 * Centralized UI state management.
 * 
 * Strategy:
 * - React Query → Server data (CRUD, lists)
 * - Zustand UI stores → UI state (modals, sidebar, selections)
 * - URL State → Persistent filters, pagination
 */

// Modal store
export {
  useModalStore,
  useModal,
  selectOpenModal,
  selectModalData,
  selectIsAnyModalOpen,
  type ModalId,
} from './modal-store'

// Sidebar store
export {
  useSidebarStore,
  selectIsCollapsed,
  selectIsMobileOpen,
  selectExpandedGroup,
  selectPinnedItems,
} from './sidebar-store'

// Selection store
export {
  useSelectionStore,
  useSelection,
} from './selection-store'

