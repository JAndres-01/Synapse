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
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          setIsClickBlocked(false)
        }, 150)
      }
    }

    checkModal()

    const handleModalEvent = () => checkModal()
    window.addEventListener('synapse:modal-state-change', handleModalEvent)

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
        'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] left-0 right-0 z-40 max-w-[330px] mx-auto px-2 transition-all duration-200 ease-out pointer-events-none select-none',
        shouldHide
          ? 'opacity-0 translate-y-16 scale-95 invisible'
          : 'opacity-100 translate-y-0 scale-100 visible'
      )}
    >
      {/* Cápsula Flotante estilo Netflix con Vidrio Esmerilado Profundo */}
      <div
        className={cn(
          'flex items-center justify-between p-1 rounded-full bg-zinc-900/80 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all',
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
                'relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-full transition-all duration-150 active:scale-90',
                tab.isActive
                  ? 'bg-white/[0.14] text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 active:bg-white/[0.06]'
              )}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-transform duration-150',
                    tab.isActive ? 'scale-105 text-white' : 'text-zinc-400'
                  )}
                  strokeWidth={tab.isActive ? 2.2 : 1.7}
                />

                {/* Badge de tareas pendientes */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-3 px-0.5 rounded-full bg-red-500 text-white text-[8.5px] font-bold flex items-center justify-center shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[9px] mt-0.5 tracking-tight transition-colors',
                  tab.isActive ? 'text-white font-semibold' : 'text-zinc-400 font-medium'
                )}
              >
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
