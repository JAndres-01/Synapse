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
import type { Schedule, Task, Subject } from '@/types/personal'
import { MinimalistLiveHero } from '@/components/today/MinimalistLiveHero'
import { MinimalistTodayTasks } from '@/components/today/MinimalistTodayTasks'
import { MinimalistDayTimeline } from '@/components/today/MinimalistDayTimeline'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile } = usePersonalAuth()

  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Modal Unificado de Tareas
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day // 1: Lun ... 5: Vie
  }

  const loadData = useCallback(async () => {
    const [cachedScheds, cachedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getSchedules(),
      personalStorage.getTasks(),
      personalStorage.getSubjects(),
    ])

    const todayNum = getTodayDayOfWeek()
    setSchedulesToday(cachedScheds.filter((s) => s.day_of_week === todayNum))
    setTasks(cachedTasks)
    setSubjects(cachedSubjs)

    if (!user?.id) return

    try {
      const [schedRes, tasksRes, subjRes] = await Promise.all([
        supabase.from('schedules').select('*, subject:subjects(*)').eq('user_id', user.id),
        supabase.from('tasks').select('*, subject:subjects(*)').eq('user_id', user.id),
        supabase.from('subjects').select('*').eq('user_id', user.id),
      ])

      if (schedRes.data) {
        setSchedulesToday(schedRes.data.filter((s) => s.day_of_week === todayNum))
        personalStorage.saveSchedules(schedRes.data)
      }
      if (tasksRes.data) {
        setTasks(tasksRes.data)
        personalStorage.saveTasks(tasksRes.data)
      }
      if (subjRes.data) {
        setSubjects(subjRes.data)
        personalStorage.saveSubjects(subjRes.data)
      }
    } catch (err) {
      console.warn('Sync background offline:', err)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus as 'pending' | 'completed' } : t
    )
    setTasks(updatedTasks)
    await personalStorage.saveTasks(updatedTasks)

    if (activeTask && activeTask.id === taskId) {
      setActiveTask({ ...activeTask, status: newStatus as 'pending' | 'completed' })
    }

    if (user?.id) {
      supabase.from('tasks').update({ status: newStatus }).eq('id', taskId).then(() => {})
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== taskId)
    setTasks(updatedTasks)
    await personalStorage.saveTasks(updatedTasks)
    if (user?.id) {
      supabase.from('tasks').delete().eq('id', taskId).then(() => {})
    }
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#818CF8']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera / Saludo */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>HOLA DE NUEVO</Text>
              <Text style={styles.userName}>{profile?.full_name || 'Estudiante'}</Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('medium')
                setActiveTask(null)
                setTaskModalMode('create')
              }}
              style={styles.headerAddBtn}
            >
              <Plus size={15} color="#09090B" strokeWidth={2.8} />
              <Text style={styles.headerAddBtnText}>Tarea</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero Card Dinámica: Clase en Vivo / Próxima */}
        <MinimalistLiveHero schedules={schedulesToday} />

        {/* Bloque de Tareas Próximas */}
        <MinimalistTodayTasks
          tasks={tasks}
          onToggleTask={handleToggleTaskStatus}
          onOpenTaskDetail={(t) => {
            triggerHaptic('light')
            setActiveTask(t)
            setTaskModalMode('detail')
          }}
          onNavigateToTasks={() => router.replace('/(tabs)/tasks')}
        />

        {/* Timeline Continuo de Clases */}
        <MinimalistDayTimeline schedulesToday={schedulesToday} />
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
  greeting: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerAddBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
  },
})
