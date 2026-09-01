import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  Dimensions,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { Schedule, Subject, Task } from '@/types/personal'
import { MinimalistDayView } from '@/components/schedule/MinimalistDayView'
import { MinimalistWeeklyMatrix } from '@/components/schedule/MinimalistWeeklyMatrix'
import { MinimalistSubjectModal } from '@/components/schedule/MinimalistSubjectModal'
import { MinimalistAssignSlotModal } from '@/components/schedule/MinimalistAssignSlotModal'
import { MinimalistDayTasksModal } from '@/components/schedule/MinimalistDayTasksModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, LayoutGrid, CalendarDays, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useRouter, useFocusEffect } from 'expo-router'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = usePersonalAuth()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
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
    existingSchedule: null,
  })

  // Modal de Tareas del Día (Minimalista y Rápido)
  const [dayTasksModalData, setDayTasksModalData] = useState<{
    visible: boolean
    day: number
  }>({
    visible: false,
    day: initialDay,
  })

  // Animaciones del Switcher de Vista (Día / Semana)
  const segmentWidth = (SCREEN_WIDTH - 32 - 6) / 2
  const viewModeAnim = useRef(new Animated.Value(0)).current

  const handleViewModeChange = (mode: 'day' | 'week') => {
    triggerHaptic('selection')
    setViewMode(mode)
    Animated.spring(viewModeAnim, {
      toValue: mode === 'day' ? 0 : segmentWidth,
      stiffness: 500,
      damping: 32,
      mass: 0.8,
      useNativeDriver: true,
    }).start()
  }

  const loadData = useCallback(async () => {
    const [cachedScheds, cachedSubjs, cachedTasks] = await Promise.all([
      personalStorage.getSchedules(),
      personalStorage.getSubjects(),
      personalStorage.getTasks(),
    ])

    // Resolver materias dinámicamente y filtrar materias eliminadas
    const resolvedScheds = cachedScheds.map((s) => {
      const foundSubj = cachedSubjs.find((subj) => subj.id === s.subject_id)
      return {
        ...s,
        subject: foundSubj || null,
      }
    }).filter((s) => Boolean(s.subject))

    const resolvedTasks = cachedTasks.map((t) => {
      const foundSubj = cachedSubjs.find((subj) => subj.id === t.subject_id)
      return {
        ...t,
        subject: foundSubj || null,
        subject_id: foundSubj ? t.subject_id : null,
      }
    })

    setSchedules(resolvedScheds)
    setSubjects(cachedSubjs)
    setTasks(resolvedTasks)

    if (!user) return

    try {
      const [schedRes, subjRes, taskRes] = await Promise.all([
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
        supabase
          .from('tasks')
          .select('*, subject:subjects(*)')
          .eq('user_id', user.id)
          .order('due_date', { ascending: true }),
      ])

      if (subjRes.data) {
        const allSubjs = subjRes.data as Subject[]
        await personalStorage.setSubjects(allSubjs)
        setSubjects(allSubjs)
      }

      if (schedRes.data) {
        const allScheds = schedRes.data as Schedule[]
        const resolvedRemoteScheds = allScheds.map((s) => {
          const foundSubj = (subjRes.data || cachedSubjs).find((subj: any) => subj.id === s.subject_id)
          return {
            ...s,
            subject: foundSubj || null,
          }
        }).filter((s) => Boolean(s.subject))

        await personalStorage.setSchedules(resolvedRemoteScheds)
        setSchedules(resolvedRemoteScheds)
      }

      if (taskRes.data) {
        const allTasks = taskRes.data as Task[]
        const resolvedRemoteTasks = allTasks.map((t) => {
          const foundSubj = (subjRes.data || cachedSubjs).find((subj: any) => subj.id === t.subject_id)
          return {
            ...t,
            subject: foundSubj || null,
            subject_id: foundSubj ? t.subject_id : null,
          }
        })
        await personalStorage.setTasks(resolvedRemoteTasks)
        setTasks(resolvedRemoteTasks)
      }
    } catch (err) {
      console.log('Sync info:', err)
    } finally {
      setRefreshing(false)
    }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenAssign = (day: number, block: number, existingSchedule?: Schedule) => {
    triggerHaptic('light')
    setAssignModalData({
      visible: true,
      day,
      block,
      existingSchedule: existingSchedule || null,
    })
  }

  const handleOpenDayTasks = (day: number) => {
    triggerHaptic('light')
    setDayTasksModalData({
      visible: true,
      day,
    })
  }

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    )

    try {
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        const updatedTask = { ...task, status: nextStatus }
        await personalStorage.saveTask(updatedTask)
        supabase
          .from('tasks')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', taskId)
          .then(() => {})
      }
    } catch (err) {
      console.error('Error toggling status:', err)
    }
  }

  const handleOpenTaskInTasksTab = (task: Task) => {
    triggerHaptic('light')
    // Cerrar el modal del día primero de forma suave
    setDayTasksModalData((prev) => ({ ...prev, visible: false }))

    // Navegar fluidamente a la pestaña Tareas y resaltar la tarea
    setTimeout(() => {
      router.navigate({
        pathname: '/(tabs)/tasks',
        params: {
          taskId: task.id,
          highlightTimestamp: Date.now().toString(),
        },
      })
    }, 120)
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
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
        {/* Header Coherente con Tareas y Hoy */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Horario</Text>
              <Text style={styles.subtitle}>4 bloques diarios • 7:00 AM - 1:00 PM</Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setShowSubjectModal(true)
              }}
              style={styles.manageSubjBtn}
            >
              <BookOpen size={13} color="#09090B" />
              <Text style={styles.manageSubjBtnText}>Materias</Text>
            </Pressable>
          </View>
        </View>

        {/* Segmented Control iOS con Glassmorfismo Nativo (BlurView) */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 55 : 90}
          tint={Platform.OS === 'ios' ? 'systemThinMaterialDark' : 'dark'}
          style={styles.segmentedContainer}
        >
          <Animated.View
            style={[
              styles.activeSegmentPill,
              {
                width: segmentWidth,
                transform: [{ translateX: viewModeAnim }],
              },
            ]}
          />

          <Pressable
            onPress={() => handleViewModeChange('day')}
            style={styles.segmentButton}
          >
            <CalendarDays
              size={13.5}
              color={viewMode === 'day' ? '#09090B' : '#A1A1AA'}
            />
            <Text
              style={[
                styles.segmentButtonText,
                viewMode === 'day' && styles.segmentButtonTextActive,
              ]}
            >
              Vista Diaria
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleViewModeChange('week')}
            style={styles.segmentButton}
          >
            <LayoutGrid
              size={13.5}
              color={viewMode === 'week' ? '#09090B' : '#A1A1AA'}
            />
            <Text
              style={[
                styles.segmentButtonText,
                viewMode === 'week' && styles.segmentButtonTextActive,
              ]}
            >
              Matriz Semanal
            </Text>
          </Pressable>
        </BlurView>

        {/* Vista Seleccionada */}
        {viewMode === 'day' ? (
          <MinimalistDayView
            schedules={schedules}
            subjects={subjects}
            tasks={tasks}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onOpenDayTasks={handleOpenDayTasks}
          />
        ) : (
          <MinimalistWeeklyMatrix
            schedules={schedules}
            subjects={subjects}
            tasks={tasks}
            onAssignSlot={handleOpenAssign}
          />
        )}
      </ScrollView>

      {/* Modal de Tareas del Día (Activado desde la Matriz Semanal) */}
      <MinimalistDayTasksModal
        visible={dayTasksModalData.visible}
        day={dayTasksModalData.day}
        schedules={schedules}
        tasks={tasks}
        onClose={() => setDayTasksModalData((prev) => ({ ...prev, visible: false }))}
        onToggleTaskStatus={handleToggleTaskStatus}
        onOpenTaskDetail={handleOpenTaskInTasksTab}
      />

      {/* Modal de Asignar Bloque (Desde Vista Diaria) */}
      {user && (
        <MinimalistAssignSlotModal
          visible={assignModalData.visible}
          onClose={() => setAssignModalData((prev) => ({ ...prev, visible: false }))}
          userId={user.id}
          subjects={subjects}
          initialDay={assignModalData.day}
          initialBlock={assignModalData.block}
          existingSchedule={assignModalData.existingSchedule}
          onScheduleSaved={loadData}
        />
      )}

      {/* Modal de Administrar Materias */}
      {user && (
        <MinimalistSubjectModal
          visible={showSubjectModal}
          onClose={() => setShowSubjectModal(false)}
          userId={user.id}
          subjects={subjects}
          onSubjectsUpdated={loadData}
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
    gap: 16,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  manageSubjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: 14,
  },
  manageSubjBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '800',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    position: 'relative',
    height: 42,
    alignItems: 'center',
    overflow: 'hidden',
  },
  activeSegmentPill: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
    zIndex: 1,
  },
  segmentButtonText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
  },
  segmentButtonTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
})
