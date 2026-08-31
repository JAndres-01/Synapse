// Gestor centralizado de estado de modales con Set de identificadores únicos
// Garantiza que la isla de navegación permanezca 100% oculta durante transiciones de modales (ej. Detalle -> Editar)

const activeModals = new Set<string>()

export function registerModal(modalId: string) {
  activeModals.add(modalId)
  if (typeof document !== 'undefined') {
    document.body.classList.add('body-scroll-lock')
    document.body.setAttribute('data-modal-open', 'true')
    window.dispatchEvent(
      new CustomEvent('synapse:modal-state-change', {
        detail: { isOpen: true, activeCount: activeModals.size },
      })
    )
  }
}

export function unregisterModal(modalId: string) {
  activeModals.delete(modalId)
  if (typeof document !== 'undefined' && activeModals.size === 0) {
    document.body.classList.remove('body-scroll-lock')
    document.body.removeAttribute('data-modal-open')
    window.dispatchEvent(
      new CustomEvent('synapse:modal-state-change', {
        detail: { isOpen: false, activeCount: 0 },
      })
    )
  }
}

export function isAnyModalOpen(): boolean {
  if (typeof document === 'undefined') return false
  return (
    activeModals.size > 0 ||
    document.body.classList.contains('body-scroll-lock') ||
    document.body.getAttribute('data-modal-open') === 'true'
  )
}
