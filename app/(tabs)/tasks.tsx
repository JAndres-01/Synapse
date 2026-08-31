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
import { useNativeAuth } from '@/context/NativeAuthContext'
import { supabase } from '@/lib/nativeSupabase'
import type { Task, Subject } from '@/types/database'
import { NativeTaskCard } from '@/components/tasks/NativeTaskCard'
import { NativeTaskDetailModal } from '@/components/modals/NativeTaskDetailModal'
import { NativeCreateTaskModal } from '@/components/modals/NativeCreateTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckSquare, Plus, Users, User, Search, CheckCircle2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function TasksScreen() {
  const insets = useSafeAreaInsets()
  const { user, profile, classroom } = useNativeAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [activeScope, setActiveScope] = useState<'classroom' | 'private'>('classroom')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')

  // Modales
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  const isAdmin =
    classroom?.created_by === user?.id ||
    profile?.role === 'admin' ||
    (profile?.role as string) === 'delegate'

  const loadCached = async () => {
    try {
      const cached = await AsyncStorage.getItem('synapse_cached_tasks_list')
      const cachedSubj = await AsyncStorage.getItem('synapse_cached_all_subjects')
      if (cached) setTasks(JSON.parse(cached))
      if (cachedSubj) setSubjects(JSON.parse(cachedSubj))
    } catch {}
  }

  const fetchTasksData = useCallback(async () => {
    if (!classroom || !user) return

    try {
      const [tasksRes, subjRes] = await Promise.all([
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

      if (tasksRes.data) {
        setTasks(tasksRes.data as Task[])
        await AsyncStorage.setItem('synapse_cached_tasks_list', JSON.stringify(tasksRes.data)).catch(() => {})
      }

      if (subjRes.data) {
        setSubjects(subjRes.data as Subject[])
        await AsyncStorage.setItem('synapse_cached_all_subjects', JSON.stringify(subjRes.data)).catch(() => {})
      }
    } catch (err) {
      console.error('Error cargando tareas:', err)
    } finally {
      setRefreshing(false)
    }
  }, [classroom, user])

  useEffect(() => {
    loadCached()
    fetchTasksData()

    if (!classroom) return

    const channel = supabase
      .channel(`public:native_tasks:${classroom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `classroom_id=eq.${classroom.id}` },
        () => fetchTasksData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_task_status' },
        () => fetchTasksData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [classroom, fetchTasksData])

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    if (!user) return
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    setTasks((prev) =>
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
      fetchTasksData()
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', taskId)
      fetchTasksData()
    } catch (err) {
      console.error('Error eliminando tarea:', err)
    }
  }

  // Filtrado de tareas
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Ámbito
      if (activeScope === 'classroom') {
        if (task.is_private) return false
      } else {
        if (!task.is_private || task.created_by !== user?.id) return false
      }

      // 2. Filtro de Materia
      if (selectedSubjectId !== 'all') {
        if (task.subject_id !== selectedSubjectId) return false
      }

      // 3. Filtro de Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = task.title?.toLowerCase().includes(q)
        const matchesSubj = task.subject?.name?.toLowerCase().includes(q)
        if (!matchesTitle && !matchesSubj) return false
      }

      // 4. Filtro de Estado
      const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string; user_id?: string }> }).user_task_status
      const isCompleted = Array.isArray(statuses)
        ? statuses.some((s) => (!user?.id || s.user_id === user.id) && s.status === 'completed')
        : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

      if (statusFilter === 'pending' && isCompleted) return false
      if (statusFilter === 'completed' && !isCompleted) return false

      return true
    })
  }, [tasks, activeScope, selectedSubjectId, searchQuery, statusFilter, user?.id])

  const onRefresh = () => {
    setRefreshing(true)
    fetchTasksData()
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
            <CheckSquare size={20} color="#818CF8" />
            <Text style={styles.title}>Tareas y Pendientes</Text>
          </View>
          <Text style={styles.subtitle}>
            Organiza entregas oficiales de tu salón y tus pendientes personales
          </Text>
        </View>

        {/* Barra de Búsqueda */}
        <View style={styles.searchBar}>
          <Search size={15} color="#71717A" style={styles.searchIcon} />
          <TextInput
            placeholder="Buscar por tarea o materia..."
            placeholderTextColor="#52525B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Selector de Ámbito: "Del Salón" vs "Mis Pendientes" */}
        <View style={styles.scopeSelector}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setActiveScope('classroom')
            }}
            style={[styles.scopeBtn, activeScope === 'classroom' && styles.scopeBtnActive]}
          >
            <Users size={13} color={activeScope === 'classroom' ? '#09090B' : '#71717A'} />
            <Text style={[styles.scopeBtnText, activeScope === 'classroom' && styles.scopeBtnTextActive]}>
              Del Salón
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setActiveScope('private')
            }}
            style={[styles.scopeBtn, activeScope === 'private' && styles.scopeBtnActive]}
          >
            <User size={13} color={activeScope === 'private' ? '#09090B' : '#71717A'} />
            <Text style={[styles.scopeBtnText, activeScope === 'private' && styles.scopeBtnTextActive]}>
              Mis Pendientes
            </Text>
          </Pressable>
        </View>

        {/* Filtros de Materias (Pills con Scroll Horizontal) */}
        {subjects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjPillsScroll}>
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

        {/* Filtros de Estado: Pendientes / Completadas / Todas */}
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

        {/* Lista de Tareas */}
        <View style={styles.tasksList}>
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <NativeTaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                onToggleStatus={handleToggleStatus}
                onOpenDetail={(t) => setSelectedTaskForDetail(t)}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={32} color="#27272A" />
              <Text style={styles.emptyTitle}>
                {statusFilter === 'completed'
                  ? 'No hay tareas completadas'
                  : '¡Al día! No tienes tareas aquí'}
              </Text>
              <Text style={styles.emptySub}>
                {activeScope === 'classroom'
                  ? 'Las entregas que publique el delegado aparecerán aquí.'
                  : 'Toca el botón + para añadir tu propio pendiente personal.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Botón Flotante + para Crear Tarea */}
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
      <NativeTaskDetailModal
        task={selectedTaskForDetail}
        visible={Boolean(selectedTaskForDetail)}
        onClose={() => setSelectedTaskForDetail(null)}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onToggleStatus={handleToggleStatus}
        onDeleteTask={handleDeleteTask}
        onEditTask={(t) => {
          setSelectedTaskForDetail(null)
          setTaskToEdit(t)
          setShowCreateModal(true)
        }}
      />

      {/* Modal de Creación / Edición */}
      {classroom && user && (
        <NativeCreateTaskModal
          visible={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setTaskToEdit(null)
          }}
          classroomId={classroom.id}
          currentUserId={user.id}
          isAdmin={isAdmin}
          subjects={subjects}
          initialTask={taskToEdit}
          onTaskSaved={fetchTasksData}
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
    gap: 14,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  scopeSelector: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
  },
  scopeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  scopeBtnText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  scopeBtnTextActive: {
    color: '#09090B',
    fontWeight: '700',
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
    borderRadius: 14,
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
    borderRadius: 18,
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
  tasksList: {
    gap: 2,
    marginTop: 4,
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
