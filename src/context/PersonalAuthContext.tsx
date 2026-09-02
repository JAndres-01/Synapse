import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { personalStorage } from '@/lib/personalStorage'
import type { PersonalProfile } from '@/types/personal'

interface PersonalAuthContextType {
  user: { id: string } | null
  profile: PersonalProfile | null
  loading: boolean
  updateProfile: (fullName: string, email?: string) => Promise<void>
  refreshProfile: () => Promise<void>
  clearData: () => Promise<void>
}

const PersonalAuthContext = createContext<PersonalAuthContextType | undefined>(undefined)

export function PersonalAuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PersonalProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadLocalProfile = async () => {
    try {
      const p = await personalStorage.getProfile()
      setProfile(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocalProfile()
  }, [])

  const updateProfile = async (fullName: string, email?: string) => {
    const current = profile || (await personalStorage.getProfile())
    const updated: PersonalProfile = {
      ...current,
      full_name: fullName.trim() || 'Estudiante',
      email: email ? email.trim() : current.email,
      updated_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(updated)
    setProfile(updated)
  }

  const refreshProfile = async () => {
    const p = await personalStorage.getProfile()
    setProfile(p)
  }

  const clearData = async () => {
    await personalStorage.clearAll()
    const defaultProfile: PersonalProfile = {
      id: 'local_user',
      full_name: 'Estudiante',
      email: '',
      theme: 'dark',
      created_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(defaultProfile)
    setProfile(defaultProfile)
  }

  const value = useMemo(
    () => ({
      user: { id: profile?.id || 'local_user' },
      profile,
      loading,
      updateProfile,
      refreshProfile,
      clearData,
    }),
    [profile, loading]
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
