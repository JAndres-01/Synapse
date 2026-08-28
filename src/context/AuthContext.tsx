'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Classroom } from '@/types/database'
import { offlineDB } from '@/lib/db'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  classroom: Classroom | null
  loading: boolean
  refreshProfile: () => Promise<void>
  refreshClassroom: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  classroom: null,
  loading: true,
  refreshProfile: async () => {},
  refreshClassroom: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem('synapse_cached_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem('synapse_cached_profile')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [classroom, setClassroom] = useState<Classroom | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem('synapse_active_classroom')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Si ya tenemos usuario y salón en caché, no bloqueamos la interfaz con spinner
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const hasUser = !!localStorage.getItem('synapse_cached_user')
      return !hasUser
    } catch {
      return true
    }
  })

  const supabase = createClient()

  const refreshProfile = async (targetUser?: User | null) => {
    const currentUser = targetUser !== undefined ? targetUser : user
    if (!currentUser) {
      setProfile(null)
      try {
        localStorage.removeItem('synapse_cached_profile')
      } catch {}
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (data && !error) {
        setProfile(data as Profile)
        try {
          localStorage.setItem('synapse_cached_profile', JSON.stringify(data))
        } catch {}
        if (offlineDB) {
          await offlineDB.profile.put(data as Profile)
        }
      }
    } catch (err) {
      console.error('Error cargando perfil:', err)
      if (offlineDB && currentUser) {
        const cached = await offlineDB.profile.get(currentUser.id)
        if (cached) setProfile(cached)
      }
    }
  }

  const refreshClassroom = async (targetUser?: User | null) => {
    const currentUser = targetUser !== undefined ? targetUser : user
    if (!currentUser) {
      setClassroom(null)
      try {
        localStorage.removeItem('synapse_active_classroom')
      } catch {}
      return
    }

    try {
      // Buscar si el usuario ya es miembro de un salón
      const { data: memberData } = await supabase
        .from('classroom_members')
        .select('classroom_id, classrooms(*)')
        .eq('user_id', currentUser.id)
        .limit(1)
        .single()

      if (memberData && memberData.classrooms) {
        const room = memberData.classrooms as unknown as Classroom
        setClassroom(room)
        try {
          localStorage.setItem('synapse_active_classroom', JSON.stringify(room))
        } catch {}
      } else {
        // Verificar si es creador de un salón
        const { data: createdRoom } = await supabase
          .from('classrooms')
          .select('*')
          .eq('created_by', currentUser.id)
          .limit(1)
          .single()

        if (createdRoom) {
          const room = createdRoom as Classroom
          setClassroom(room)
          try {
            localStorage.setItem('synapse_active_classroom', JSON.stringify(room))
          } catch {}
        } else {
          setClassroom(null)
          try {
            localStorage.removeItem('synapse_active_classroom')
          } catch {}
        }
      }
    } catch (err) {
      console.error('Error cargando salón:', err)
      // Recuperar de localStorage si no hay red
      try {
        const savedRoom = localStorage.getItem('synapse_active_classroom')
        if (savedRoom) setClassroom(JSON.parse(savedRoom))
      } catch {}
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const activeUser = session?.user ?? null
        setUser(activeUser)

        if (activeUser) {
          try {
            localStorage.setItem('synapse_cached_user', JSON.stringify(activeUser))
          } catch {}
          await Promise.all([
            refreshProfile(activeUser),
            refreshClassroom(activeUser),
          ])
        } else {
          try {
            localStorage.removeItem('synapse_cached_user')
            localStorage.removeItem('synapse_cached_profile')
          } catch {}
        }
      } catch (err) {
        console.error('Error inicializando sesión:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const activeUser = session?.user ?? null
        setUser(activeUser)

        if (activeUser) {
          try {
            localStorage.setItem('synapse_cached_user', JSON.stringify(activeUser))
          } catch {}
          await Promise.all([
            refreshProfile(activeUser),
            refreshClassroom(activeUser),
          ])
        } else {
          setProfile(null)
          setClassroom(null)
          try {
            localStorage.removeItem('synapse_cached_user')
            localStorage.removeItem('synapse_cached_profile')
            localStorage.removeItem('synapse_active_classroom')
          } catch {}
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    setUser(null)
    setProfile(null)
    setClassroom(null)
    if (offlineDB) {
      try {
        await offlineDB.profile.clear()
        await offlineDB.tasks.clear()
        await offlineDB.schedules.clear()
        await offlineDB.subjects.clear()
      } catch {}
    }
    try {
      localStorage.removeItem('synapse_cached_user')
      localStorage.removeItem('synapse_cached_profile')
      localStorage.removeItem('synapse_active_classroom')
    } catch {}
    window.location.href = '/auth'
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        classroom,
        loading,
        refreshProfile,
        refreshClassroom,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
