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
        // Debounce: mantener clicks bloqueados durante 250ms al cerrar modal para absorber toques accidentales
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          setIsClickBlocked(false)
        }, 250)
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
        'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+8px)] left-0 right-0 z-40 max-w-[360px] mx-auto px-3 transition-all duration-150 ease-out',
        shouldHide
          ? 'opacity-0 translate-y-12 scale-90 pointer-events-none invisible'
          : 'opacity-100 translate-y-0 scale-100 pointer-events-auto visible'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-around px-2 py-1.5 rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-zinc-800/90 shadow-2xl shadow-black/80 transition-all',
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
                'relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 active:scale-90',
                tab.isActive
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-transform duration-150',
                    tab.isActive && 'scale-105 text-zinc-100'
                  )}
                  strokeWidth={tab.isActive ? 2.2 : 1.8}
                />

                {/* Badge de tareas pendientes */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 min-w-[15px] h-3.5 px-1 rounded-full bg-zinc-100 text-zinc-950 text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[10px] font-medium mt-0.5 transition-opacity',
                  tab.isActive ? 'text-zinc-100 opacity-100 font-semibold' : 'text-zinc-500 opacity-80'
                )}
              >
                {tab.name}
              </span>

              {/* Punto indicador luminoso activo */}
              {tab.isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
