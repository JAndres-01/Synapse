'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, CheckSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingIslandBarProps {
  pendingTasksCount?: number
}

export function FloatingIslandBar({ pendingTasksCount = 0 }: FloatingIslandBarProps) {
  const pathname = usePathname()

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

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-4 right-4 max-w-[390px] mx-auto z-50 pointer-events-auto"
    >
      <div className="flex items-center justify-around px-3 py-2 rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 shadow-2xl shadow-black/80">
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
