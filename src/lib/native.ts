import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform()
}

export const triggerHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'
) => {
  if (!Capacitor.isPluginAvailable('Haptics')) {
    // Fallback web navigator.vibrate si está disponible
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'light') navigator.vibrate(10)
        else if (type === 'medium') navigator.vibrate(20)
        else if (type === 'heavy') navigator.vibrate(35)
        else if (type === 'success') navigator.vibrate([15, 30, 20])
      } catch {}
    }
    return
  }

  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light })
        break
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium })
        break
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy })
        break
      case 'success':
        await Haptics.notification({ type: NotificationType.Success })
        break
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning })
        break
      case 'error':
        await Haptics.notification({ type: NotificationType.Error })
        break
    }
  } catch (err) {
    // Silencioso si no está disponible
  }
}

export const dismissKeyboard = async () => {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  if (Capacitor.isPluginAvailable('Keyboard')) {
    try {
      await Keyboard.hide()
    } catch {}
  }
}

export const initNativeApp = async () => {
  // Inicialización de la app nativa
}
