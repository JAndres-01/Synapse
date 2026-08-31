import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { PersonalProfile } from '@/types/personal'

interface PersonalAuthContextType {
  user: User | { id: string; email?: string } | null
  session: Session | null
  profile: PersonalProfile | null
  loading: boolean
  signInWithEmail: (email: string, pass: string) => Promise<void>
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const PersonalAuthContext = createContext<PersonalAuthContextType | undefined>(undefined)

export function PersonalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<PersonalProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadLocalProfile = async () => {
    let saved = await personalStorage.getProfile()
    if (!saved) {
      const defaultId = 'user_' + Math.random().toString(36).substring(2, 11)
      saved = {
        id: defaultId,
        full_name: 'Mi Espacio',
        email: 'estudiante@synapse.local',
        theme: 'dark',
        created_at: new Date().toISOString(),
      }
      await personalStorage.setProfile(saved)
    }
    setProfile(saved)
    setUser({ id: saved.id, email: saved.email })
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session && mounted) {
          setSession(data.session)
          setUser(data.session.user)
          const profileData: PersonalProfile = {
            id: data.session.user.id,
            full_name: data.session.user.user_metadata?.full_name || 'Estudiante',
            email: data.session.user.email || '',
            theme: 'dark',
            created_at: data.session.user.created_at,
          }
          setProfile(profileData)
          await personalStorage.setProfile(profileData)
        } else {
          await loadLocalProfile()
        }
      } catch {
        await loadLocalProfile()
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (newSession) {
        setUser(newSession.user)
        const profileData: PersonalProfile = {
          id: newSession.user.id,
          full_name: newSession.user.user_metadata?.full_name || 'Estudiante',
          email: newSession.user.email || '',
          theme: 'dark',
          created_at: newSession.user.created_at,
        }
        setProfile(profileData)
        await personalStorage.setProfile(profileData)
      } else {
        await loadLocalProfile()
      }
    })

    return () => {
      mounted = false
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) throw error
    if (data.user) {
      setUser(data.user)
      setSession(data.session)
      const p: PersonalProfile = {
        id: data.user.id,
        full_name: data.user.user_metadata?.full_name || email.split('@')[0],
        email: data.user.email || '',
        theme: 'dark',
        created_at: data.user.created_at,
      }
      setProfile(p)
      await personalStorage.setProfile(p)
    }
  }

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: name } },
    })
    if (error) throw error
    if (data.user) {
      setUser(data.user)
      setSession(data.session)
      const p: PersonalProfile = {
        id: data.user.id,
        full_name: name,
        email: data.user.email || '',
        theme: 'dark',
        created_at: data.user.created_at,
      }
      setProfile(p)
      await personalStorage.setProfile(p)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    await loadLocalProfile()
  }

  const refreshProfile = async () => {
    const saved = await personalStorage.getProfile()
    if (saved) setProfile(saved)
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
    throw new Error('usePersonalAuth must be used within PersonalAuthProvider')
  }
  return context
}
