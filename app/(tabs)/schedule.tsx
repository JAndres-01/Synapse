import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
} from 'react-native'
import { useNativeAuth } from '@/context/NativeAuthContext'
import { supabase } from '@/lib/nativeSupabase'
import type { Schedule, Subject } from '@/types/database'
import { NativeDayView } from '@/components/schedule/NativeDayView'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const { user, profile, classroom } = useNativeAuth()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const currentDay = new Date().getDay()
  const initialDay = currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  const [selectedDay, setSelectedDay] = useState<number>(initialDay)

  const isAdmin =
    classroom?.created_by === user?.id ||
    profile?.role === 'admin' ||
    (profile?.role as string) === 'delegate'

  const loadCached = async () => {
    try {
      const cachedSched = await AsyncStorage.getItem('synapse_cached_all_schedules')
      const cachedSubj = await AsyncStorage.getItem('synapse_cached_all_subjects')
      if (cachedSched) setSchedules(JSON.parse(cachedSched))
      if (cachedSubj) setSubjects(JSON.parse(cachedSubj))
    } catch {}
  }

  const fetchScheduleData = useCallback(async () => {
    if (!classroom) return

    try {
      const [schedRes, subjRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('*, subject:subjects(*)')
          .eq('classroom_id', classroom.id)
          .order('block_number', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('classroom_id', classroom.id)
          .order('name', { ascending: true }),
      ])

      if (schedRes.data) {
        setSchedules(schedRes.data as Schedule[])
        await AsyncStorage.setItem('synapse_cached_all_schedules', JSON.stringify(schedRes.data)).catch(() => {})
      }

      if (subjRes.data) {
        setSubjects(subjRes.data as Subject[])
        await AsyncStorage.setItem('synapse_cached_all_subjects', JSON.stringify(subjRes.data)).catch(() => {})
      }
    } catch (err) {
      console.error('Error cargando horario:', err)
    } finally {
      setRefreshing(false)
    }
  }, [classroom])

  useEffect(() => {
    loadCached()
    fetchScheduleData()

    if (!classroom) return

    const channel = supabase
      .channel(`public:native_schedule:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchScheduleData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subjects', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchScheduleData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, fetchScheduleData])

  const onRefresh = () => {
    setRefreshing(true)
    fetchScheduleData()
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FFFFFF"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Calendar size={20} color="#818CF8" />
          <Text style={styles.title}>Horario de Clases</Text>
        </View>
        <Text style={styles.subtitle}>
          4 bloques diarios de 80 minutos • 7:00 AM - 1:00 PM
        </Text>
      </View>

      {/* Vista Diaria */}
      <NativeDayView
        schedules={schedules}
        subjects={subjects}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        isAdmin={isAdmin}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    gap: 4,
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12,
  },
})
