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

  const refreshProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setProfile(null)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data && !error) {
        setProfile(data as Profile)
        // Guardar en caché offline
        if (offlineDB) {
          await offlineDB.profile.put(data as Profile)
        }
      }
    } catch (err) {
      console.error('Error cargando perfil:', err)
      // Intentar cargar desde IndexedDB si estamos offline
      if (offlineDB && user) {
        const cached = await offlineDB.profile.get(user.id)
        if (cached) setProfile(cached)
      }
    }
  }

  const refreshClassroom = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setClassroom(null)
        return
      }

      // Buscar si el usuario ya es miembro de un salón
      const { data: memberData } = await supabase
        .from('classroom_members')
        .select('classroom_id, classrooms(*)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (memberData && memberData.classrooms) {
        setClassroom(memberData.classrooms as unknown as Classroom)
      } else {
        // Verificar si es creador de un salón
        const { data: createdRoom } = await supabase
          .from('classrooms')
          .select('*')
          .eq('created_by', user.id)
          .limit(1)
          .single()

        if (createdRoom) {
          setClassroom(createdRoom as Classroom)
        } else {
          setClassroom(null)
        }
      }
    } catch (err) {
      console.error('Error cargando salón:', err)
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      if (session?.user) {
        await Promise.all([refreshProfile(), refreshClassroom()])
      }
      setLoading(false)
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await Promise.all([refreshProfile(), refreshClassroom()])
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
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setClassroom(null)
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
