'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, CheckSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isAnyModalOpen } from '@/lib/modalManager'

interface FloatingIslandBarProps {
  pendingTasksCount?: number
}

export function FloatingIslandBar({ pendingTasksCount = 0 }: FloatingIslandBarProps) {
  const pathname = usePathname()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isClickBlocked, setIsClickBlocked] = useState(false)

  // Observar si algún modal está activo en la pantalla
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    const checkModal = () => {
      const locked = isAnyModalOpen()
      setIsModalOpen(locked)
      if (locked) {
        if (timer) clearTimeout(timer)
        setIsClickBlocked(true)
      } else {
        // Debounce de seguridad al cerrar modal para absorber toques residuales de iOS
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          setIsClickBlocked(false)
        }, 200)
      }
    }

    checkModal()

    // 1. Evento personalizado de gestión de modales (0ms respuesta inmediata)
    const handleModalEvent = () => checkModal()
    window.addEventListener('synapse:modal-state-change', handleModalEvent)

    // 2. MutationObserver en document.body para detectar cambios de clase o atributos
    const observer = new MutationObserver(() => {
      checkModal()
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-modal-open'],
    })

    return () => {
      window.removeEventListener('synapse:modal-state-change', handleModalEvent)
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const tabs = [
    {
      name: 'Hoy',
      href: '/app/today',
      icon: Home,
      isActive: pathname === '/app/today',
    },
    {
      name: 'Horario',
      href: '/app/schedule',
      icon: Calendar,
      isActive: pathname.startsWith('/app/schedule'),
    },
    {
      name: 'Tareas',
      href: '/app/tasks',
      icon: CheckSquare,
      isActive: pathname.startsWith('/app/tasks'),
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
    },
    {
      name: 'Salón',
      href: '/app/settings',
      icon: Settings,
      isActive: pathname.startsWith('/app/settings'),
    },
  ]

  const shouldHide = isModalOpen || isClickBlocked

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+8px)] left-0 right-0 z-40 max-w-[340px] mx-auto px-3 transition-all duration-200 ease-out',
        shouldHide
          ? 'opacity-0 translate-y-16 scale-90 pointer-events-none invisible'
          : 'opacity-100 translate-y-0 scale-100 pointer-events-auto visible'
      )}
    >
      {/* Contenedor Flotante con Alto Contraste y Vidrio Esmerilado Intensificado */}
      <div
        className={cn(
          'flex items-center justify-around px-2 py-1.5 rounded-full bg-zinc-850/85 backdrop-blur-2xl backdrop-saturate-200 border border-zinc-700/80 shadow-[0_16px_36px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all',
          shouldHide ? 'pointer-events-none' : 'pointer-events-auto'
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                'relative flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all duration-150 active:scale-90',
                tab.isActive
                  ? 'bg-zinc-700/80 text-white shadow-xs border border-zinc-600/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/30 border border-transparent'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-4.5 h-4.5 transition-transform duration-150',
                    tab.isActive ? 'scale-105 text-white' : 'text-zinc-400'
                  )}
                  strokeWidth={tab.isActive ? 2.4 : 1.9}
                />

                {/* Badge de tareas pendientes */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2.5 min-w-[15px] h-3.5 px-1 rounded-full bg-white text-zinc-950 text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[9.5px] font-medium mt-0.5 transition-colors',
                  tab.isActive ? 'text-white font-bold' : 'text-zinc-400'
                )}
              >
                {tab.name}
              </span>

              {/* Punto indicador luminoso activo */}
              {tab.isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,1)]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
