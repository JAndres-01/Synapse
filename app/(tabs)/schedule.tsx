import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  Dimensions,
  Platform,
  InteractionManager,
  LayoutAnimation,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Schedule, Subject, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MinimalistDayView } from '@/components/schedule/MinimalistDayView'
import { MinimalistWeeklyMatrix } from '@/components/schedule/MinimalistWeeklyMatrix'
import { MinimalistSubjectModal } from '@/components/schedule/MinimalistSubjectModal'
import { MinimalistAssignSlotModal } from '@/components/schedule/MinimalistAssignSlotModal'
import { MinimalistDayTasksModal } from '@/components/schedule/MinimalistDayTasksModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Calendar, LayoutGrid, CalendarDays, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek } from '@/lib/academicDateUtils'
import {
  cancelTaskReminder,
  scheduleTaskReminder,
  scheduleClassReminders,
} from '@/lib/personalNotifications'
import { useRouter, useFocusEffect } from 'expo-router'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = usePersonalAuth()

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const cachedScheds = personalStorage.getCachedSchedules()
    const cachedSubjs = personalStorage.getCachedSubjects()
    return cachedScheds
      .map((s) => {
        const foundSubj = cachedSubjs.find((subj) => subj.id === s.subject_id)
        return {
          ...s,
          subject: foundSubj || null,
        }
      })
      .filter((s) => Boolean(s.subject))
  })
  const [tasks, setTasks] = useState<Task[]>(() => {
    const cachedTasks = personalStorage.getCachedTasks()
    const cachedSubjs = personalStorage.getCachedSubjects()
    return cachedTasks.map((t) => {
      const foundSubj = cachedSubjs.find((subj) => subj.id === t.subject_id)
      return {
        ...t,
        subject: foundSubj || null,
        subject_id: foundSubj ? t.subject_id : null,
      }
    })
  })
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  const academicWeek = React.useMemo(() => getActiveAcademicWeek(), [])
  const [selectedDay, setSelectedDay] = useState<number>(academicWeek.defaultSelectedDay)

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
    subjectId?: string | null
  }>({
    visible: false,
    day: academicWeek.defaultSelectedDay,
    subjectId: null,
  })

  // Animaciones del Switcher de Vista (Día / Semana)
  const [segmentContainerWidth, setSegmentContainerWidth] = useState(SCREEN_WIDTH - 32)
  const segmentWidth = Math.max(0, (segmentContainerWidth - 6) / 2)
  const viewModeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(viewModeAnim, {
      toValue: viewMode === 'day' ? 0 : segmentWidth,
      stiffness: 750,
      damping: 28,
      mass: 0.5,
      useNativeDriver: true,
    }).start()
  }, [viewMode, segmentWidth, viewModeAnim])

  const handleViewModeChange = (mode: 'day' | 'week') => {
    if (mode === viewMode) return
    Animated.spring(viewModeAnim, {
      toValue: mode === 'day' ? 0 : segmentWidth,
      stiffness: 750,
      damping: 28,
      mass: 0.5,
      useNativeDriver: true,
    }).start()

    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.84 },
    })
    setViewMode(mode)
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
  }, [])

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadData()
      })
      return () => task.cancel()
    }, [loadData])
  )

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToPersonalStorage(() => {
      loadData()
    })
    return unsubscribe
  }, [loadData])

  const handleOpenAssign = useCallback((day: number, block: number, existingSchedule?: Schedule | null) => {
    triggerHaptic('light')
    setAssignModalData({
      visible: true,
      day,
      block,
      existingSchedule: existingSchedule || null,
    })
  }, [])

  const handleSaveSlot = async (subjectId: string, classroom?: string) => {
    const blockDef = PERSONAL_SCHEDULE_BLOCKS.find((b) => b.block === assignModalData.block)
    const existingIndex = schedules.findIndex(
      (s) => s.day_of_week === assignModalData.day && s.block_number === assignModalData.block
    )

    let updatedSchedules: Schedule[]
    if (existingIndex >= 0) {
      updatedSchedules = schedules.map((s, idx) =>
        idx === existingIndex
          ? {
              ...s,
              subject_id: subjectId,
              classroom_room: classroom || null,
            }
          : s
      )
    } else {
      const newScheduleItem: Schedule = {
        id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        user_id: user?.id || 'personal',
        day_of_week: assignModalData.day,
        block_number: assignModalData.block,
        start_time: blockDef?.startTime || '07:00',
        end_time: blockDef?.endTime || '08:30',
        subject_id: subjectId,
        classroom_room: classroom || null,
        created_at: new Date().toISOString(),
      }
      updatedSchedules = [...schedules, newScheduleItem]
    }

    setSchedules(updatedSchedules)
    await personalStorage.setSchedules(updatedSchedules)

    // Re-sincronizar notificaciones de horarios
    const prefs = await personalStorage.getPreferences()
    await scheduleClassReminders(updatedSchedules, prefs)
  }

  const handleDeleteSlot = async () => {
    const updated = schedules.filter(
      (s) => !(s.day_of_week === assignModalData.day && s.block_number === assignModalData.block)
    )
    setSchedules(updated)
    await personalStorage.setSchedules(updated)

    // Re-sincronizar notificaciones
    const prefs = await personalStorage.getPreferences()
    await scheduleClassReminders(updated, prefs)
  }

  const handleOpenDayTasks = useCallback((day: number, subjectId?: string | null) => {
    triggerHaptic('light')
    setDayTasksModalData({
      visible: true,
      day,
      subjectId: subjectId || null,
    })
  }, [])

  const handleToggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    if (newStatus === 'completed') {
      cancelTaskReminder(taskId)
    } else {
      const taskObj = tasks.find((t) => t.id === taskId)
      if (taskObj) {
        const prefs = await personalStorage.getPreferences()
        scheduleTaskReminder({ ...taskObj, status: 'pending' }, prefs)
      }
    }

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus as 'pending' | 'completed' } : t
    )
    setTasks(updatedTasks)
    await personalStorage.setTasks(updatedTasks)
  }, [tasks])

  const handleOpenTaskDetailFromModal = useCallback((task: Task) => {
    triggerHaptic('light')
    setDayTasksModalData((prev) => ({ ...prev, visible: false }))
    setTimeout(() => {
      router.navigate({
        pathname: '/(tabs)/tasks',
        params: {
          taskId: task.id,
          highlightTimestamp: Date.now().toString(),
        },
      })
    }, 120)
  }, [router])

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Coherente con Tareas y Hoy */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Horario</Text>
              <Text style={styles.subtitle}>{academicWeek.fullLabel}</Text>
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
          tint="dark"
          style={styles.segmentedContainer}
          onLayout={(e: LayoutChangeEvent) => {
            const w = e.nativeEvent.layout.width
            if (w > 0 && Math.abs(w - segmentContainerWidth) > 1) {
              setSegmentContainerWidth(w)
            }
          }}
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
            onPressIn={() => handleViewModeChange('day')}
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
            onPressIn={() => handleViewModeChange('week')}
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
            onAssignSlot={handleOpenAssign}
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

      {/* Modal de Tareas del Día */}
      <MinimalistDayTasksModal
        visible={dayTasksModalData.visible}
        day={dayTasksModalData.day}
        subjectId={dayTasksModalData.subjectId}
        schedules={schedules}
        tasks={tasks}
        onClose={() => setDayTasksModalData((prev) => ({ ...prev, visible: false, subjectId: null }))}
        onToggleTaskStatus={handleToggleTaskStatus}
        onOpenTaskDetail={handleOpenTaskDetailFromModal}
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
