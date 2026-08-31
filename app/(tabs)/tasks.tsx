import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import { MinimalistTaskDetailModal } from '@/components/tasks/MinimalistTaskDetailModal'
import { MinimalistCreateTaskModal } from '@/components/tasks/MinimalistCreateTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckSquare, Plus, Search, CheckCircle2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

export default function TasksScreen() {
  const insets = useSafeAreaInsets()
  const { user } = usePersonalAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')

  // Modales
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  const loadLocalCache = async () => {
    const [cachedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getTasks(),
      personalStorage.getSubjects(),
    ])
    setTasks(cachedTasks)
    setSubjects(cachedSubjs)
  }

  const fetchCloudData = useCallback(async () => {
    if (!user) return

    try {
      const [tasksRes, subjRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, subject:subjects(*)')
          .eq('user_id', user.id)
          .order('due_date', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ])

      if (tasksRes.data) {
        const allTasks = tasksRes.data as Task[]
        await personalStorage.setTasks(allTasks)
        setTasks(allTasks)
      }

      if (subjRes.data) {
        const allSubjs = subjRes.data as Subject[]
        await personalStorage.setSubjects(allSubjs)
        setSubjects(allSubjs)
      }
    } catch (err) {
      console.error('Error sincronizando tareas:', err)
    } finally {
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadLocalCache()
    fetchCloudData()

    if (!user) return

    const channel = supabase
      .channel(`personal_tasks_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        () => fetchCloudData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchCloudData])

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    const updated = tasks.map((t) => {
      if (t.id === taskId) return { ...t, status: nextStatus as 'pending' | 'completed' }
      return t
    })
    setTasks(updated)
    await personalStorage.setTasks(updated)

    try {
      await supabase
        .from('tasks')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId)
    } catch (err) {
      fetchCloudData()
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId)
    setTasks(updated)
    await personalStorage.setTasks(updated)

    try {
      await supabase.from('tasks').delete().eq('id', taskId)
    } catch (err) {
      fetchCloudData()
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filtro de Materia
      if (selectedSubjectId !== 'all' && task.subject_id !== selectedSubjectId) {
        return false
      }

      // Filtro de BÃºsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = task.title?.toLowerCase().includes(q)
        const matchSubj = task.subject?.name?.toLowerCase().includes(q)
        if (!matchTitle && !matchSubj) return false
      }

      // Filtro de Estado
      if (statusFilter === 'pending' && task.status === 'completed') return false
      if (statusFilter === 'completed' && task.status !== 'completed') return false

      return true
    })
  }, [tasks, selectedSubjectId, searchQuery, statusFilter])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCloudData()
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <CheckSquare size={18} color="#818CF8" />
            <Text style={styles.title}>Mis Tareas</Text>
          </View>
          <Text style={styles.subtitle}>
            Organiza tus entregas, talleres, lecturas y exÃ¡menes
          </Text>
        </View>

        {/* Buscador */}
        <View style={styles.searchBar}>
          <Search size={14} color="#71717A" style={styles.searchIcon} />
          <TextInput
            placeholder="Buscar por tarea o materia..."
            placeholderTextColor="#52525B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Filtros de Materias (Pills Horizontales) */}
        {subjects.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjPillsScroll}
          >
            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setSelectedSubjectId('all')
              }}
              style={[styles.subjPill, selectedSubjectId === 'all' && styles.subjPillActive]}
            >
              <Text style={[styles.subjPillText, selectedSubjectId === 'all' && styles.subjPillTextActive]}>
                Todas
              </Text>
            </Pressable>

            {subjects.map((s) => {
              const isSelected = selectedSubjectId === s.id
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    triggerHaptic('light')
                    setSelectedSubjectId(s.id)
                  }}
                  style={[styles.subjPill, isSelected && styles.subjPillActive]}
                >
                  <View style={[styles.dot, { backgroundColor: s.color || '#6366F1' }]} />
                  <Text style={[styles.subjPillText, isSelected && styles.subjPillTextActive]}>
                    {s.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        {/* Filtros de Estado */}
        <View style={styles.statusFiltersRow}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setStatusFilter('pending')
            }}
            style={[styles.statusPill, statusFilter === 'pending' && styles.statusPillActive]}
          >
            <Text style={[styles.statusPillText, statusFilter === 'pending' && styles.statusPillTextActive]}>
              Pendientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setStatusFilter('completed')
            }}
            style={[styles.statusPill, statusFilter === 'completed' && styles.statusPillActive]}
          >
            <Text style={[styles.statusPillText, statusFilter === 'completed' && styles.statusPillTextActive]}>
              Completadas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setStatusFilter('all')
            }}
            style={[styles.statusPill, statusFilter === 'all' && styles.statusPillActive]}
          >
            <Text style={[styles.statusPillText, statusFilter === 'all' && styles.statusPillTextActive]}>
              Todas
            </Text>
          </Pressable>
        </View>

        {/* Lista Plana de Tareas (Zero Carditis) */}
        <View style={styles.tasksContainer}>
          {filteredTasks.length > 0 ? (
            <View style={styles.flatListCard}>
              {filteredTasks.map((task, idx) => (
                <MinimalistTaskRow
                  key={task.id}
                  task={task}
                  isLast={idx === filteredTasks.length - 1}
                  onToggleStatus={handleToggleStatus}
                  onOpenDetail={(t) => setSelectedTask(t)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={32} color="#27272A" />
              <Text style={styles.emptyTitle}>
                {statusFilter === 'completed'
                  ? 'No hay tareas completadas'
                  : 'Â¡Al dÃ­a! No tienes tareas pendientes'}
              </Text>
              <Text style={styles.emptySub}>
                Toca el botÃ³n + flotante para aÃ±adir un nuevo pendiente o entrega.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* BotÃ³n Flotante (+) Minimalista */}
      <Pressable
        onPress={() => {
          triggerHaptic('medium')
          setTaskToEdit(null)
          setShowCreateModal(true)
        }}
        style={[styles.fab, { bottom: Math.max(insets.bottom, 12) + 70 }]}
      >
        <Plus size={22} color="#09090B" strokeWidth={2.8} />
      </Pressable>

      {/* Modal de Detalle */}
      <MinimalistTaskDetailModal
        task={selectedTask}
        visible={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onToggleStatus={handleToggleStatus}
        onDeleteTask={handleDeleteTask}
        onEditTask={(t) => {
          setSelectedTask(null)
          setTaskToEdit(t)
          setShowCreateModal(true)
        }}
      />

      {/* Modal de CreaciÃ³n */}
      {user && (
        <MinimalistCreateTaskModal
          visible={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setTaskToEdit(null)
          }}
          userId={user.id}
          subjects={subjects}
          initialTask={taskToEdit}
          onTaskSaved={fetchCloudData}
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    gap: 2,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  subjPillsScroll: {
    gap: 6,
  },
  subjPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  subjPillActive: {
    backgroundColor: '#27272A',
    borderColor: '#52525B',
  },
  subjPillText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  subjPillTextActive: {
    color: '#FFFFFF',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusFiltersRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusPillActive: {
    backgroundColor: '#27272A',
    borderColor: '#3F3F46',
  },
  statusPillText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  tasksContainer: {
    marginTop: 4,
  },
  flatListCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
})
