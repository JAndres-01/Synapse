import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { PersonalProfile } from '@/types/personal'
import type { User, Session } from '@supabase/supabase-js'

interface PersonalAuthContextType {
  user: User | null
  session: Session | null
  profile: PersonalProfile | null
  loading: boolean
  signInWithEmail: (email: string, pass: string) => Promise<{ error: Error | null }>
  signUpWithEmail: (email: string, pass: string, fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const PersonalAuthContext = createContext<PersonalAuthContextType | undefined>(undefined)

export function PersonalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<PersonalProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadFromCache = async () => {
    const cachedProfile = await personalStorage.getProfile()
    if (cachedProfile) {
      setProfile(cachedProfile)
    }
  }

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data && !error) {
        const userProf: PersonalProfile = {
          id: data.id,
          email: data.email || email || '',
          full_name: data.full_name || 'Estudiante',
          avatar_url: data.avatar_url,
          created_at: data.created_at,
        }
        setProfile(userProf)
        await personalStorage.setProfile(userProf)
      } else {
        const fallbackProf: PersonalProfile = {
          id: userId,
          email: email || '',
          full_name: 'Estudiante',
        }
        setProfile(fallbackProf)
        await personalStorage.setProfile(fallbackProf)
      }
    } catch {
      // Fallback a perfil básico
      const fallbackProf: PersonalProfile = {
        id: userId,
        email: email || '',
        full_name: 'Estudiante',
      }
      setProfile(fallbackProf)
    }
  }

  useEffect(() => {
    loadFromCache()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      })
      return { error }
    } catch (err: any) {
      return { error: err }
    }
  }

  const signUpWithEmail = async (email: string, pass: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (!error && data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          updated_at: new Date().toISOString(),
        })
      }

      return { error }
    } catch (err: any) {
      return { error: err }
    }
  }

  const signOut = async () => {
    await personalStorage.clearAll()
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email)
    }
  }

  return (
    <PersonalAuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </PersonalAuthContext.Provider>
  )
}

export function usePersonalAuth() {
  const context = useContext(PersonalAuthContext)
  if (!context) {
    throw new Error('usePersonalAuth debe ser usado dentro de un PersonalAuthProvider')
  }
  return context
}
