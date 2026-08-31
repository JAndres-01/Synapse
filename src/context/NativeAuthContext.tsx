import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/nativeSupabase'
import type { User } from '@supabase/supabase-js'
import type { Profile, Classroom } from '@/types/database'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface NativeAuthContextType {
  user: User | null
  profile: Profile | null
  classroom: Classroom | null
  loading: boolean
  refreshProfile: (targetUser?: User | null) => Promise<void>
  refreshClassroom: (targetUser?: User | null) => Promise<void>
  signOut: () => Promise<void>
}

const NativeAuthContext = createContext<NativeAuthContextType>({
  user: null,
  profile: null,
  classroom: null,
  loading: true,
  refreshProfile: async () => {},
  refreshClassroom: async () => {},
  signOut: async () => {},
})

export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshProfile = useCallback(async (targetUser?: User | null) => {
    const currentUser = targetUser !== undefined ? targetUser : user
    if (!currentUser) {
      setProfile(null)
      await AsyncStorage.removeItem('synapse_cached_profile').catch(() => {})
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
        await AsyncStorage.setItem('synapse_cached_profile', JSON.stringify(data)).catch(() => {})
      }
    } catch (err) {
      console.error('Error cargando perfil:', err)
      const cached = await AsyncStorage.getItem('synapse_cached_profile').catch(() => null)
      if (cached) setProfile(JSON.parse(cached))
    }
  }, [user])

  const refreshClassroom = useCallback(async (targetUser?: User | null) => {
    const currentUser = targetUser !== undefined ? targetUser : user
    if (!currentUser) {
      setClassroom(null)
      await AsyncStorage.removeItem('synapse_active_classroom').catch(() => {})
      return
    }

    try {
      // 1. Verificar si es miembro de un salón
      const { data: memberData } = await supabase
        .from('classroom_members')
        .select('classroom_id, classrooms(*)')
        .eq('user_id', currentUser.id)
        .limit(1)
        .single()

      if (memberData && memberData.classrooms) {
        const room = memberData.classrooms as unknown as Classroom
        setClassroom(room)
        await AsyncStorage.setItem('synapse_active_classroom', JSON.stringify(room)).catch(() => {})
      } else {
        // 2. Verificar si es creador de un salón
        const { data: createdRoom } = await supabase
          .from('classrooms')
          .select('*')
          .eq('created_by', currentUser.id)
          .limit(1)
          .single()

        if (createdRoom) {
          const room = createdRoom as Classroom
          setClassroom(room)
          await AsyncStorage.setItem('synapse_active_classroom', JSON.stringify(room)).catch(() => {})
        } else {
          setClassroom(null)
          await AsyncStorage.removeItem('synapse_active_classroom').catch(() => {})
        }
      }
    } catch (err) {
      console.error('Error cargando salón:', err)
      const savedRoom = await AsyncStorage.getItem('synapse_active_classroom').catch(() => null)
      if (savedRoom) setClassroom(JSON.parse(savedRoom))
    }
  }, [user])

  useEffect(() => {
    const initialize = async () => {
      try {
        const cachedUserStr = await AsyncStorage.getItem('synapse_cached_user').catch(() => null)
        const cachedProfileStr = await AsyncStorage.getItem('synapse_cached_profile').catch(() => null)
        const cachedRoomStr = await AsyncStorage.getItem('synapse_active_classroom').catch(() => null)

        if (cachedUserStr) setUser(JSON.parse(cachedUserStr))
        if (cachedProfileStr) setProfile(JSON.parse(cachedProfileStr))
        if (cachedRoomStr) setClassroom(JSON.parse(cachedRoomStr))

        const { data: { session } } = await supabase.auth.getSession()
        const activeUser = session?.user ?? null
        setUser(activeUser)

        if (activeUser) {
          await AsyncStorage.setItem('synapse_cached_user', JSON.stringify(activeUser)).catch(() => {})
          await Promise.all([
            refreshProfile(activeUser),
            refreshClassroom(activeUser),
          ])
        } else {
          await AsyncStorage.removeItem('synapse_cached_user').catch(() => {})
          await AsyncStorage.removeItem('synapse_cached_profile').catch(() => {})
          await AsyncStorage.removeItem('synapse_active_classroom').catch(() => {})
        }
      } catch (err) {
        console.error('Error inicializando auth nativo:', err)
      } finally {
        setLoading(false)
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const activeUser = session?.user ?? null
        setUser(activeUser)

        if (activeUser) {
          await AsyncStorage.setItem('synapse_cached_user', JSON.stringify(activeUser)).catch(() => {})
          await Promise.all([
            refreshProfile(activeUser),
            refreshClassroom(activeUser),
          ])
        } else {
          setProfile(null)
          setClassroom(null)
          await AsyncStorage.removeItem('synapse_cached_user').catch(() => {})
          await AsyncStorage.removeItem('synapse_cached_profile').catch(() => {})
          await AsyncStorage.removeItem('synapse_active_classroom').catch(() => {})
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshProfile, refreshClassroom])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    setUser(null)
    setProfile(null)
    setClassroom(null)
    await AsyncStorage.removeItem('synapse_cached_user').catch(() => {})
    await AsyncStorage.removeItem('synapse_cached_profile').catch(() => {})
    await AsyncStorage.removeItem('synapse_active_classroom').catch(() => {})
  }

  return (
    <NativeAuthContext.Provider
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
    </NativeAuthContext.Provider>
  )
}

export function useNativeAuth() {
  const context = useContext(NativeAuthContext)
  if (!context) {
    throw new Error('useNativeAuth must be used within a NativeAuthProvider')
  }
  return context
}
