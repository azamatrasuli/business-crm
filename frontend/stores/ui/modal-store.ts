/**
 * @fileoverview Modal Store
 * Centralized UI state for modals/dialogs.
 * Part of the State Management Strategy: Zustand for UI state only.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ModalId =
  // Employee modals
  | 'create-employee'
  | 'edit-employee'
  | 'delete-employee'
  | 'manage-lunch'
  | 'manage-compensation'
  // Order modals
  | 'guest-order'
  | 'assign-meals'
  | 'bulk-edit'
  | 'edit-subscription'
  // Confirmation modals
  | 'confirm-action'
  | 'confirm-delete'
  // Other
  | 'impersonate'
  | string // Allow custom modal IDs

interface ModalData {
  /** ID of the entity being edited (employee, order, etc.) */
  entityId?: string
  /** Type of entity */
  entityType?: 'employee' | 'order' | 'subscription' | 'project' | 'user'
  /** Additional context data */
  context?: Record<string, unknown>
  /** Callback on success */
  onSuccess?: () => void
  /** Callback on cancel */
  onCancel?: () => void
}

interface ModalState {
  /** Currently open modal ID (null if none open) */
  openModal: ModalId | null
  /** Data associated with the open modal */
  modalData: ModalData | null
  /** Stack of modals (for nested modals) */
  modalStack: Array<{ id: ModalId; data: ModalData | null }>
  /** History of recently opened modals (for analytics) */
  modalHistory: ModalId[]
}

interface ModalActions {
  /** Open a modal */
  open: (id: ModalId, data?: ModalData) => void
  /** Close the current modal */
  close: () => void
  /** Close a specific modal by ID */
  closeById: (id: ModalId) => void
  /** Close all modals */
  closeAll: () => void
  /** Update modal data without closing */
  updateData: (data: Partial<ModalData>) => void
  /** Check if a specific modal is open */
  isOpen: (id: ModalId) => boolean
  /** Push a nested modal */
  push: (id: ModalId, data?: ModalData) => void
  /** Pop back to previous modal */
  pop: () => void
}

type ModalStore = ModalState & ModalActions

// ═══════════════════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_HISTORY = 10

export const useModalStore = create<ModalStore>()(
  devtools(
    (set, get) => ({
      // State
      openModal: null,
      modalData: null,
      modalStack: [],
      modalHistory: [],

      // Actions
      open: (id, data) => {
        set(
          (state) => ({
            openModal: id,
            modalData: data ?? null,
            modalHistory: [id, ...state.modalHistory].slice(0, MAX_HISTORY),
          }),
          false,
          'modal/open'
        )
      },

      close: () => {
        const { modalData } = get()
        modalData?.onCancel?.()
        set({ openModal: null, modalData: null }, false, 'modal/close')
      },

      closeById: (id) => {
        const { openModal, modalData } = get()
        if (openModal === id) {
          modalData?.onCancel?.()
          set({ openModal: null, modalData: null }, false, 'modal/closeById')
        }
      },

      closeAll: () => {
        set(
          { openModal: null, modalData: null, modalStack: [] },
          false,
          'modal/closeAll'
        )
      },

      updateData: (data) => {
        set(
          (state) => ({
            modalData: state.modalData ? { ...state.modalData, ...data } : data,
          }),
          false,
          'modal/updateData'
        )
      },

      isOpen: (id) => {
        return get().openModal === id
      },

      push: (id, data) => {
        set(
          (state) => ({
            modalStack: [
              ...state.modalStack,
              { id: state.openModal!, data: state.modalData },
            ],
            openModal: id,
            modalData: data ?? null,
          }),
          false,
          'modal/push'
        )
      },

      pop: () => {
        set(
          (state) => {
            const stack = [...state.modalStack]
            const prev = stack.pop()
            return {
              modalStack: stack,
              openModal: prev?.id ?? null,
              modalData: prev?.data ?? null,
            }
          },
          false,
          'modal/pop'
        )
      },
    }),
    { name: 'modal-store' }
  )
)

// ═══════════════════════════════════════════════════════════════════════════════
// Selectors
// ═══════════════════════════════════════════════════════════════════════════════

export const selectOpenModal = (state: ModalStore) => state.openModal
export const selectModalData = (state: ModalStore) => state.modalData
export const selectIsAnyModalOpen = (state: ModalStore) => state.openModal !== null

// ═══════════════════════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to control a specific modal.
 *
 * @example
 * const { isOpen, open, close } = useModal('create-employee')
 * <Button onClick={() => open({ onSuccess: refetch })}>Create</Button>
 * <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>...</Dialog>
 */
export function useModal(id: ModalId) {
  const currentModal = useModalStore((s) => s.openModal)
  const modalData = useModalStore((s) => s.modalData)
  const openFn = useModalStore((s) => s.open)
  const closeFn = useModalStore((s) => s.close)

  return {
    isOpen: currentModal === id,
    data: currentModal === id ? modalData : null,
    open: (data?: ModalData) => openFn(id, data),
    close: closeFn,
  }
}

