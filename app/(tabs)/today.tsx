import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  InteractionManager,
  Animated,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Schedule, Task, Subject } from '@/types/personal'
import { MinimalistLiveHero } from '@/components/today/MinimalistLiveHero'
import { MinimalistTodayTasks } from '@/components/today/MinimalistTodayTasks'
import { MinimalistDayTimeline } from '@/components/today/MinimalistDayTimeline'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  cancelTaskReminder,
  scheduleTaskReminder,
  syncAllNotifications,
} from '@/lib/personalNotifications'

// Control de entrada única por sesión en la pantalla Hoy
let hasPlayedTodayEntrance = false

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile } = usePersonalAuth()

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day // 1: Lun ... 5: Vie
  }

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
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
  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>(() => {
    const todayNum = new Date().getDay() === 0 ? 7 : new Date().getDay()
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
      .filter((s) => Boolean(s.subject) && s.day_of_week === todayNum)
  })
  const [confettiBurstTrigger, setConfettiBurstTrigger] = useState(0)

  // Modal Unificado de Tareas
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Formato elegante de fecha actual (ej. "Lunes, 1 de Septiembre")
  const getFormattedCurrentDate = () => {
    const d = new Date()
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`
  }

  const loadData = useCallback(async () => {
    const [cachedScheds, cachedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getSchedules(),
      personalStorage.getTasks(),
      personalStorage.getSubjects(),
    ])

    const todayNum = getTodayDayOfWeek()

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

    setSchedulesToday(resolvedScheds.filter((s) => s.day_of_week === todayNum))
    setTasks(resolvedTasks)
    setSubjects(cachedSubjs)
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

  const handleToggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    if (newStatus === 'completed') {
      cancelTaskReminder(taskId)
      const prefs = await personalStorage.getPreferences()
      if (prefs.confetti_enabled) {
        setConfettiBurstTrigger((prev) => prev + 1)
      }
    } else {
      const taskObj = tasks.find((t) => t.id === taskId)
      if (taskObj) {
        personalStorage.getPreferences().then((p) =>
          scheduleTaskReminder({ ...taskObj, status: 'pending' }, p)
        )
      }
    }

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus as 'pending' | 'completed' } : t
    )
    setTasks(updatedTasks)
    await personalStorage.setTasks(updatedTasks)

    if (activeTask && activeTask.id === taskId) {
      setActiveTask({ ...activeTask, status: newStatus as 'pending' | 'completed' })
    }
  }, [tasks, activeTask])

  const handleDeleteTask = useCallback(async (taskId: string) => {
    cancelTaskReminder(taskId)
    const updatedTasks = tasks.filter((t) => t.id !== taskId)
    setTasks(updatedTasks)
    await personalStorage.setTasks(updatedTasks)
  }, [tasks])

  // Animaciones de Entrada Escalonada hacia abajo (Solo la primera vez que se entra)
  const cardEntranceAnims = useRef([
    new Animated.Value(hasPlayedTodayEntrance ? 1 : 0),
    new Animated.Value(hasPlayedTodayEntrance ? 1 : 0),
    new Animated.Value(hasPlayedTodayEntrance ? 1 : 0),
  ]).current

  useEffect(() => {
    if (!hasPlayedTodayEntrance) {
      hasPlayedTodayEntrance = true
      cardEntranceAnims.forEach((anim) => anim.setValue(0))

      const staggerAnims = cardEntranceAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          stiffness: 320,
          damping: 24,
          mass: 0.7,
          useNativeDriver: true,
        })
      )

      Animated.stagger(100, staggerAnims).start()
    }
  }, [])

  return (
    <View style={styles.screenWrapper}>
      {/* Confetti Festivo al Completar Tareas */}
      <MinimalistConfetti burstTrigger={confettiBurstTrigger} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Coherente con Tareas y Horario */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Hoy</Text>
              <Text style={styles.subtitle}>{getFormattedCurrentDate()}</Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('medium')
                setActiveTask(null)
                setTaskModalMode('create')
              }}
              style={styles.headerAddBtn}
            >
              <Plus size={14} color="#09090B" strokeWidth={2.8} />
              <Text style={styles.headerAddBtnText}>Tarea</Text>
            </Pressable>
          </View>
        </View>

        {/* Card 0: Hero Card Dinámica (Clase en Vivo / Próxima) */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[0].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <MinimalistLiveHero schedulesToday={schedulesToday} />
        </Animated.View>

        {/* Card 1: Bloque de Tareas Próximas */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[1].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <MinimalistTodayTasks
            tasks={tasks}
            onToggleTask={handleToggleTaskStatus}
            onOpenTaskDetail={(t) => {
              triggerHaptic('light')
              setActiveTask(t)
              setTaskModalMode('detail')
            }}
            onNavigateToTasks={() => router.navigate('/(tabs)/tasks')}
          />
        </Animated.View>

        {/* Card 2: Timeline Continuo de Clases con Entregas de Tareas */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[2].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <MinimalistDayTimeline
            schedulesToday={schedulesToday}
            tasks={tasks}
            onToggleTask={handleToggleTaskStatus}
            onOpenTaskDetail={(t) => {
              triggerHaptic('light')
              setActiveTask(t)
              setTaskModalMode('detail')
            }}
          />
        </Animated.View>
      </ScrollView>

      {/* Modal Unificado de Tareas (Detalle, Crear y Editar) */}
      {user && (
        <MinimalistTaskModal
          mode={taskModalMode}
          task={activeTask}
          userId={user.id}
          subjects={subjects}
          onClose={() => {
            setTaskModalMode('none')
            setActiveTask(null)
          }}
          onToggleStatus={handleToggleTaskStatus}
          onDeleteTask={handleDeleteTask}
          onTaskSaved={loadData}
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
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: 14,
  },
  headerAddBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '800',
  },
})
