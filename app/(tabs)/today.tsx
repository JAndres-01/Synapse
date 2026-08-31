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
import type { Schedule, Task, Subject } from '@/types/database'
import { NativeLiveHero } from '@/components/today/NativeLiveHero'
import { NativeUrgentCarousel } from '@/components/today/NativeUrgentCarousel'
import { NativeDayTimeline } from '@/components/today/NativeDayTimeline'
import { NativeTaskDetailModal } from '@/components/modals/NativeTaskDetailModal'
import { NativeCreateTaskModal } from '@/components/modals/NativeCreateTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus, Sparkles } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile, classroom } = useNativeAuth()

  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>([])
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Modales
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  const isAdmin =
    classroom?.created_by === user?.id ||
    profile?.role === 'admin' ||
    (profile?.role as string) === 'delegate'

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day
  }

  const loadCachedData = async () => {
    try {
      const cachedSched = await AsyncStorage.getItem('synapse_cached_schedules_today')
      const cachedTasks = await AsyncStorage.getItem('synapse_cached_urgent_tasks')
      const cachedSubj = await AsyncStorage.getItem('synapse_cached_all_subjects')
      if (cachedSched) setSchedulesToday(JSON.parse(cachedSched))
      if (cachedTasks) setUrgentTasks(JSON.parse(cachedTasks))
      if (cachedSubj) setSubjects(JSON.parse(cachedSubj))
    } catch {}
  }

  const fetchTodayData = useCallback(async () => {
    if (!classroom || !user) return

    try {
      const todayNum = getTodayDayOfWeek()

      const [schedRes, tasksRes, subjRes] = await Promise.all([
        supabase
          .from('schedules')
          .select('*, subject:subjects(*)')
          .eq('classroom_id', classroom.id)
          .eq('day_of_week', todayNum)
          .order('block_number', { ascending: true }),
        supabase
          .from('tasks')
          .select('*, subject:subjects(*), user_status:user_task_status(user_id, status)')
          .eq('classroom_id', classroom.id)
          .order('due_date', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('classroom_id', classroom.id)
          .order('name', { ascending: true }),
      ])

      if (schedRes.data) {
        setSchedulesToday(schedRes.data as Schedule[])
        await AsyncStorage.setItem('synapse_cached_schedules_today', JSON.stringify(schedRes.data)).catch(() => {})
      }

      if (tasksRes.data) {
        const visible = (tasksRes.data as Task[]).filter(
          (t) => !t.is_private || t.created_by === user.id
        )
        setUrgentTasks(visible)
        await AsyncStorage.setItem('synapse_cached_urgent_tasks', JSON.stringify(visible)).catch(() => {})
      }

      if (subjRes.data) {
        setSubjects(subjRes.data as Subject[])
        await AsyncStorage.setItem('synapse_cached_all_subjects', JSON.stringify(subjRes.data)).catch(() => {})
      }
    } catch (err) {
      console.error('Error cargando datos de hoy:', err)
    } finally {
      setRefreshing(false)
    }
  }, [classroom, user])

  useEffect(() => {
    loadCachedData()
    fetchTodayData()

    if (!classroom) return

    const channel = supabase
      .channel(`public:native_today:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchTodayData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchTodayData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, fetchTodayData])

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user) return
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    setUrgentTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            user_status: [{ user_id: user.id, status: newStatus }],
          }
        }
        return t
      })
    )

    try {
      await supabase.from('user_task_status').upsert(
        {
          task_id: taskId,
          user_id: user.id,
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,user_id' }
      )
    } catch (err) {
      console.error('Error actualizando estado:', err)
      fetchTodayData()
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', taskId)
      fetchTodayData()
    } catch (err) {
      console.error('Error eliminando tarea:', err)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchTodayData()
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
              <Text style={styles.greeting}>Buenos días</Text>
              <Text style={styles.classroomName}>{classroom?.name || 'Salón Principal'}</Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setTaskToEdit(null)
                setShowCreateTaskModal(true)
              }}
              style={styles.headerAddBtn}
            >
              <Plus size={16} color="#09090B" strokeWidth={2.5} />
              <Text style={styles.headerAddBtnText}>Nueva Tarea</Text>
            </Pressable>
          </View>
        </View>

        {/* Tarjeta En Vivo / Próxima Clase */}
        <NativeLiveHero schedulesToday={schedulesToday} />

        {/* Carrusel de Tareas Urgentes */}
        <NativeUrgentCarousel
          tasks={urgentTasks}
          currentUserId={user?.id}
          onToggleTaskStatus={handleToggleTaskStatus}
          onOpenDetail={(t) => {
            setSelectedTaskForDetail(t)
          }}
          onNavigateToTasks={() => router.push('/(tabs)/tasks')}
        />

        {/* Cronograma de 4 Clases de Hoy */}
        <NativeDayTimeline
          schedulesToday={schedulesToday}
          tasksToday={urgentTasks}
        />
      </ScrollView>

      {/* Modal de Detalle de Tarea */}
      <NativeTaskDetailModal
        task={selectedTaskForDetail}
        visible={Boolean(selectedTaskForDetail)}
        onClose={() => setSelectedTaskForDetail(null)}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onToggleStatus={handleToggleTaskStatus}
        onDeleteTask={handleDeleteTask}
        onEditTask={(task) => {
          setSelectedTaskForDetail(null)
          setTaskToEdit(task)
          setShowCreateTaskModal(true)
        }}
      />

      {/* Modal de Crear / Editar Tarea */}
      {classroom && user && (
        <NativeCreateTaskModal
          visible={showCreateTaskModal}
          onClose={() => {
            setShowCreateTaskModal(false)
            setTaskToEdit(null)
          }}
          classroomId={classroom.id}
          currentUserId={user.id}
          isAdmin={isAdmin}
          subjects={subjects}
          initialTask={taskToEdit}
          onTaskSaved={fetchTodayData}
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
    gap: 18,
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
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  classroomName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
