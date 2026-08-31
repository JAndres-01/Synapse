import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { Schedule, Subject } from '@/types/personal'
import { MinimalistDayView } from '@/components/schedule/MinimalistDayView'
import { MinimalistWeeklyMatrix } from '@/components/schedule/MinimalistWeeklyMatrix'
import { MinimalistSubjectModal } from '@/components/schedule/MinimalistSubjectModal'
import { MinimalistAssignSlotModal } from '@/components/schedule/MinimalistAssignSlotModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, LayoutGrid, CalendarDays, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const { user } = usePersonalAuth()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  const currentDay = new Date().getDay()
  const initialDay = currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  const [selectedDay, setSelectedDay] = useState<number>(initialDay)

  // Modales
  const [showSubjectModal, setShowSubjectModal] = useState(false)
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

  const loadLocalCache = async () => {
    const [cachedScheds, cachedSubjs] = await Promise.all([
      personalStorage.getSchedules(),
      personalStorage.getSubjects(),
    ])
    setSchedules(cachedScheds)
    setSubjects(cachedSubjs)
  }

  const fetchCloudData = useCallback(async () => {
    if (!user) return

    try {
      const [schedRes, subjRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('*, subject:subjects(*)')
          .eq('user_id', user.id)
          .order('block_number', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ])

      if (schedRes.data) {
        const allScheds = schedRes.data as Schedule[]
        await personalStorage.setSchedules(allScheds)
        setSchedules(allScheds)
      }

      if (subjRes.data) {
        const allSubjs = subjRes.data as Subject[]
        await personalStorage.setSubjects(allSubjs)
        setSubjects(allSubjs)
      }
    } catch (err) {
      console.error('Error sincronizando horario:', err)
    } finally {
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadLocalCache()
    fetchCloudData()

    if (!user) return

    const channel = supabase
      .channel(`personal_schedule_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `user_id=eq.${user.id}` },
        () => fetchCloudData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subjects', filter: `user_id=eq.${user.id}` },
        () => fetchCloudData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchCloudData])

  const handleOpenAssign = (day: number, block: number, existingSchedule?: Schedule) => {
    triggerHaptic('light')
    setAssignModalData({
      visible: true,
      day,
      block,
      existingSchedule: existingSchedule || null,
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchCloudData()
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.headerTitleRow}>
                <Calendar size={18} color="#818CF8" />
                <Text style={styles.title}>Horario de Clases</Text>
              </View>
              <Text style={styles.subtitle}>4 bloques diarios â€¢ 7:00 AM - 1:00 PM</Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setShowSubjectModal(true)
              }}
              style={styles.manageSubjBtn}
            >
              <BookOpen size={13} color="#FFFFFF" />
              <Text style={styles.manageSubjBtnText}>Materias</Text>
            </Pressable>
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

        {/* Vista Seleccionada */}
        {viewMode === 'day' ? (
          <MinimalistDayView
            schedules={schedules}
            subjects={subjects}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onAssignSlot={handleOpenAssign}
          />
        ) : (
          <MinimalistWeeklyMatrix
            schedules={schedules}
            subjects={subjects}
            onSlotPress={handleOpenAssign}
          />
        )}
      </ScrollView>

      {/* Modal de Asignar Bloque */}
      {user && (
        <MinimalistAssignSlotModal
          visible={assignModalData.visible}
          onClose={() => setAssignModalData((prev) => ({ ...prev, visible: false }))}
          userId={user.id}
          subjects={subjects}
          initialDay={assignModalData.day}
          initialBlock={assignModalData.block}
          existingSchedule={assignModalData.existingSchedule}
          onScheduleSaved={fetchCloudData}
        />
      )}

      {/* Modal de Administrar Materias */}
      {user && (
        <MinimalistSubjectModal
          visible={showSubjectModal}
          onClose={() => setShowSubjectModal(false)}
          userId={user.id}
          subjects={subjects}
          onSubjectsUpdated={fetchCloudData}
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
