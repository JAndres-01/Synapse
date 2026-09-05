import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'
import { personalStorage } from '@/lib/personalStorage'
import { cancelAllNotifications } from '@/lib/personalNotifications'
import type { PersonalProfile } from '@/types/personal'

interface PersonalAuthContextType {
  user: { id: string } | null
  profile: PersonalProfile | null
  updateProfile: (fullName: string) => Promise<void>
  updateCredential: (credentialUrl: string | null, credentialName?: string | null) => Promise<void>
  clearData: () => Promise<void>
}

const PersonalAuthContext = createContext<PersonalAuthContextType | undefined>(undefined)

export function PersonalAuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PersonalProfile | null>(null)

  const loadLocalProfile = async () => {
    const p = await personalStorage.getProfile()
    setProfile(p)
  }

  useEffect(() => {
    loadLocalProfile()
  }, [])

  const updateProfile = async (fullName: string) => {
    const current = profile || (await personalStorage.getProfile())
    const updated: PersonalProfile = {
      ...current,
      full_name: fullName.trim() || 'Estudiante',
      updated_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(updated)
    setProfile(updated)
  }

  const updateCredential = async (credentialUrl: string | null, credentialName?: string | null) => {
    const current = profile || (await personalStorage.getProfile())
    const updated: PersonalProfile = {
      ...current,
      student_credential_url: credentialUrl,
      student_credential_name: credentialName !== undefined ? credentialName : (credentialUrl ? 'Credencial_Digital.pdf' : null),
      student_credential_updated_at: credentialUrl ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(updated)
    setProfile(updated)
  }

  const clearData = async () => {
    await cancelAllNotifications()
    await personalStorage.clearAll()
    const defaultProfile: PersonalProfile = {
      id: 'local_user',
      full_name: 'Estudiante',
      student_credential_url: null,
      student_credential_name: null,
      student_credential_updated_at: null,
      created_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(defaultProfile)
    setProfile(defaultProfile)
  }

  const value = useMemo(
    () => ({
      user: { id: profile?.id || 'local_user' },
      profile,
      updateProfile,
      updateCredential,
      clearData,
    }),
    [profile]
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
