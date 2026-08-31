// Gestor centralizado de estado de modales con contador de referencias
// Evita desincronizaciones cuando un modal abre otro modal (ej. Detalle -> Editar)

let activeModalsCount = 0

export function lockBodyScroll() {
  activeModalsCount++
  if (typeof document !== 'undefined') {
    document.body.classList.add('body-scroll-lock')
    document.body.setAttribute('data-modal-open', 'true')
    window.dispatchEvent(
      new CustomEvent('synapse:modal-state-change', {
        detail: { isOpen: true, count: activeModalsCount },
      })
    )
  }
}

export function unlockBodyScroll() {
  activeModalsCount = Math.max(0, activeModalsCount - 1)
  if (typeof document !== 'undefined' && activeModalsCount === 0) {
    document.body.classList.remove('body-scroll-lock')
    document.body.removeAttribute('data-modal-open')
    window.dispatchEvent(
      new CustomEvent('synapse:modal-state-change', {
        detail: { isOpen: false, count: 0 },
      })
    )
  }
}

export function isAnyModalOpen(): boolean {
  if (typeof document === 'undefined') return false
  return (
    activeModalsCount > 0 ||
    document.body.classList.contains('body-scroll-lock') ||
    document.body.getAttribute('data-modal-open') === 'true'
  )
}
