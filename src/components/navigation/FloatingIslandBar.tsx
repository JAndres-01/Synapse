'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, CheckSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingIslandBarProps {
  pendingTasksCount?: number
}

export function FloatingIslandBar({ pendingTasksCount = 0 }: FloatingIslandBarProps) {
  const pathname = usePathname()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isClickBlocked, setIsClickBlocked] = useState(false)

  // Observar si algún modal está activo en la pantalla (usando body-scroll-lock)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    const checkModal = () => {
      const locked = document.body.classList.contains('body-scroll-lock')
      setIsModalOpen(locked)
      if (locked) {
        if (timer) clearTimeout(timer)
        setIsClickBlocked(true)
      } else {
        // Debounce: mantener los clicks bloqueados durante 350ms para absorber ghost-clicks de iOS
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          setIsClickBlocked(false)
        }, 350)
      }
    }

    checkModal()

    const observer = new MutationObserver(() => {
      checkModal()
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
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
        'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-0 right-0 z-40 max-w-md mx-auto px-4 transition-all duration-200 ease-out',
        shouldHide ? 'opacity-0 translate-y-10 scale-95 pointer-events-none' : 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-around px-3 py-2 rounded-2xl bg-zinc-900/95 backdrop-blur-lg border border-zinc-800 shadow-2xl shadow-black transition-all',
          shouldHide ? 'pointer-events-none invisible' : 'pointer-events-auto'
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                'relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 active:scale-90',
                tab.isActive
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-transform duration-200',
                    tab.isActive && 'scale-110 text-zinc-100'
                  )}
                  strokeWidth={tab.isActive ? 2.2 : 1.8}
                />

                {/* Badge de tareas pendientes */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-zinc-100 text-zinc-950 text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[10px] font-medium mt-1 transition-opacity',
                  tab.isActive ? 'text-zinc-100 opacity-100 font-semibold' : 'text-zinc-400 opacity-80'
                )}
              >
                {tab.name}
              </span>

              {/* Punto indicador luminoso activo */}
              {tab.isActive && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
