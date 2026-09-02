import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { PersonalProfile } from '@/types/personal'

interface PersonalAuthContextType {
  user: User | null
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
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<PersonalProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session && mounted) {
          setSession(data.session)
          setUser(data.session.user)

          let fullName = data.session.user.user_metadata?.full_name || 'Estudiante'
          try {
            const { data: pRow } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', data.session.user.id)
              .single()
            if (pRow?.full_name) fullName = pRow.full_name
          } catch {}

          const profileData: PersonalProfile = {
            id: data.session.user.id,
            full_name: fullName,
            email: data.session.user.email || '',
            theme: 'dark',
            created_at: data.session.user.created_at,
          }
          setProfile(profileData)
          await personalStorage.setProfile(profileData)
        } else if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } catch (e) {
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
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
        let fullName = newSession.user.user_metadata?.full_name || 'Estudiante'
        try {
          const { data: pRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newSession.user.id)
            .single()
          if (pRow?.full_name) fullName = pRow.full_name
        } catch {}

        const profileData: PersonalProfile = {
          id: newSession.user.id,
          full_name: fullName,
          email: newSession.user.email || '',
          theme: 'dark',
          created_at: newSession.user.created_at,
        }
        setProfile(profileData)
        await personalStorage.setProfile(profileData)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: pass })
    if (error) throw error
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
      let profileName = data.session.user.user_metadata?.full_name || 'Estudiante'
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.session.user.id)
          .single()
        if (profileRow?.full_name) {
          profileName = profileRow.full_name
        }
      } catch {}

      const profileData: PersonalProfile = {
        id: data.session.user.id,
        full_name: profileName,
        email: data.session.user.email || cleanEmail,
        theme: 'dark',
        created_at: data.session.user.created_at,
      }
      setProfile(profileData)
      await personalStorage.setProfile(profileData)
    }
  }

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: { data: { full_name: cleanName } },
    })
    if (error) throw error
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)

      // Guardar también en tabla profiles si existe
      try {
        await supabase.from('profiles').upsert({
          id: data.session.user.id,
          full_name: cleanName,
          email: cleanEmail,
          updated_at: new Date().toISOString(),
        })
      } catch {}

      const profileData: PersonalProfile = {
        id: data.session.user.id,
        full_name: cleanName,
        email: data.session.user.email || cleanEmail,
        theme: 'dark',
        created_at: data.session.user.created_at,
      }
      setProfile(profileData)
      await personalStorage.setProfile(profileData)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    await personalStorage.clearAll()
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user?.id) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        await personalStorage.setProfile(data)
      }
    }
  }

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, loading]
  )

  return (
    <PersonalAuthContext.Provider value={value}>
      {children}
    </PersonalAuthContext.Provider>
  )
}

export function usePersonalAuth() {
  const context = useContext(PersonalAuthContext)
  if (!context) {
    throw new Error('usePersonalAuth must be used within a PersonalAuthProvider')
  }
  return context
}
