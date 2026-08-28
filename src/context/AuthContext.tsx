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
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const refreshProfile = async (targetUser?: User | null) => {
    const currentUser = targetUser !== undefined ? targetUser : user
    if (!currentUser) {
      setProfile(null)
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
          await Promise.all([
            refreshProfile(activeUser),
            refreshClassroom(activeUser),
          ])
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
          await Promise.all([
            refreshProfile(activeUser),
            refreshClassroom(activeUser),
          ])
        } else {
          setProfile(null)
          setClassroom(null)
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
      } catch {}
    }
    try {
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

export const useAuth = () => useContext(AuthContext)
