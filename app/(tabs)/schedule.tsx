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
import { NativeWeeklyMatrix } from '@/components/schedule/NativeWeeklyMatrix'
import { NativeManageSubjectsModal } from '@/components/modals/NativeManageSubjectsModal'
import { NativeAssignScheduleModal } from '@/components/modals/NativeAssignScheduleModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, LayoutGrid, CalendarDays, BookOpen, Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const { user, profile, classroom } = useNativeAuth()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  const currentDay = new Date().getDay()
  const initialDay = currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  const [selectedDay, setSelectedDay] = useState<number>(initialDay)

  // Modales
  const [showManageSubjectsModal, setShowManageSubjectsModal] = useState(false)
  const [assignModalData, setAssignModalData] = useState<{
    visible: boolean
    day: number
    block: number
    existingSchedule?: Schedule | null
  }>({
    visible: false,
    day: 1,
    block: 1,
  })

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

  const handleOpenAssign = (day: number, block: number, existingSchedule?: Schedule) => {
    triggerHaptic('light')
    setAssignModalData({
      visible: true,
      day,
      block,
      existingSchedule: existingSchedule || null,
    })
  }

  return (
    <View style={styles.screenWrapper}>
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
          <View style={styles.headerTop}>
            <View>
              <View style={styles.headerTitleRow}>
                <Calendar size={20} color="#818CF8" />
                <Text style={styles.title}>Horario de Clases</Text>
              </View>
              <Text style={styles.subtitle}>
                4 bloques diarios • 7:00 AM - 1:00 PM
              </Text>
            </View>

            {isAdmin && (
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setShowManageSubjectsModal(true)
                }}
                style={styles.manageSubjBtn}
              >
                <BookOpen size={13} color="#FFFFFF" />
                <Text style={styles.manageSubjBtnText}>Materias</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Selector de Modo: Vista Diaria vs Matriz Semanal */}
        <View style={styles.viewModeSelector}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setViewMode('day')
            }}
            style={[styles.viewModeBtn, viewMode === 'day' && styles.viewModeBtnActive]}
          >
            <CalendarDays size={13} color={viewMode === 'day' ? '#09090B' : '#71717A'} />
            <Text style={[styles.viewModeBtnText, viewMode === 'day' && styles.viewModeBtnTextActive]}>
              Vista Diaria
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setViewMode('week')
            }}
            style={[styles.viewModeBtn, viewMode === 'week' && styles.viewModeBtnActive]}
          >
            <LayoutGrid size={13} color={viewMode === 'week' ? '#09090B' : '#71717A'} />
            <Text style={[styles.viewModeBtnText, viewMode === 'week' && styles.viewModeBtnTextActive]}>
              Matriz Semanal
            </Text>
          </Pressable>
        </View>

        {/* Vista Activa */}
        {viewMode === 'day' ? (
          <NativeDayView
            schedules={schedules}
            subjects={subjects}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            isAdmin={isAdmin}
            onAssignSlot={handleOpenAssign}
          />
        ) : (
          <NativeWeeklyMatrix
            schedules={schedules}
            subjects={subjects}
            isAdmin={isAdmin}
            onSlotPress={handleOpenAssign}
          />
        )}
      </ScrollView>

      {/* Modal de Asignar Bloque */}
      {classroom && (
        <NativeAssignScheduleModal
          visible={assignModalData.visible}
          onClose={() => setAssignModalData((prev) => ({ ...prev, visible: false }))}
          classroomId={classroom.id}
          subjects={subjects}
          initialDay={assignModalData.day}
          initialBlock={assignModalData.block}
          existingSchedule={assignModalData.existingSchedule}
          onScheduleSaved={fetchScheduleData}
        />
      )}

      {/* Modal de Administrar Materias */}
      {classroom && (
        <NativeManageSubjectsModal
          visible={showManageSubjectsModal}
          onClose={() => setShowManageSubjectsModal(false)}
          classroomId={classroom.id}
          subjects={subjects}
          onSubjectsUpdated={fetchScheduleData}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginTop: 2,
  },
  manageSubjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  manageSubjBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 11,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  viewModeBtnText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  viewModeBtnTextActive: {
    color: '#09090B',
    fontWeight: '700',
  },
})
