import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import { MinimalistTaskDetailModal } from '@/components/tasks/MinimalistTaskDetailModal'
import { MinimalistCreateTaskModal } from '@/components/tasks/MinimalistCreateTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckSquare, Plus, Search, CheckCircle2, X } from 'lucide-react-native'
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
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // Modales
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  // Animación del botón flotante FAB
  const fabScaleAnim = useRef(new Animated.Value(1)).current

  const loadData = useCallback(async () => {
    const [cachedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getTasks(),
      personalStorage.getSubjects(),
    ])
    setTasks(cachedTasks)
    setSubjects(cachedSubjs)

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

      if (tasksRes.data && tasksRes.data.length > 0) {
        const allTasks = tasksRes.data as Task[]
        await personalStorage.setTasks(allTasks)
        setTasks(allTasks)
      }

      if (subjRes.data && subjRes.data.length > 0) {
        const allSubjs = subjRes.data as Subject[]
        await personalStorage.setSubjects(allSubjs)
        setSubjects(allSubjs)
      }
    } catch (err) {
      console.log('Sync tasks info:', err)
    } finally {
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

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
    } catch {
      // Offline fallback
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const updated = await personalStorage.removeTask(taskId)
    setTasks(updated)
    supabase.from('tasks').delete().eq('id', taskId).then(() => {})
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filtro de Materia
      if (selectedSubjectId !== 'all' && task.subject_id !== selectedSubjectId) {
        return false
      }

      // Filtro de Búsqueda
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
    loadData()
  }

  const handleClearSearch = () => {
    triggerHaptic('selection')
    setSearchQuery('')
  }

  const handleFabPressIn = () => {
    Animated.spring(fabScaleAnim, {
      toValue: 0.9,
      stiffness: 600,
      damping: 25,
      useNativeDriver: true,
    }).start()
  }

  const handleFabPressOut = () => {
    Animated.spring(fabScaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 20,
      useNativeDriver: true,
    }).start()
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 105 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* Header Estilo iOS Grande */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <CheckSquare size={20} color="#FFFFFF" />
            <Text style={styles.title}>Mis Tareas</Text>
          </View>
          <Text style={styles.subtitle}>
            Entregas, talleres, lecturas y exámenes
          </Text>
        </View>

        {/* Buscador Estilo iOS Nativo (Cápsula Translúcida con Botón Limpiar) */}
        <View
          style={[
            styles.searchBar,
            isSearchFocused && styles.searchBarFocused,
          ]}
        >
          <Search size={15} color={isSearchFocused ? '#FFFFFF' : '#A1A1AA'} style={styles.searchIcon} />
          <TextInput
            placeholder="Buscar por tarea o materia..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch} hitSlop={10} style={styles.clearSearchBtn}>
              <X size={13} color="#D4D4D8" />
            </Pressable>
          )}
        </View>

        {/* Filtros de Materias Mejorados (Cápsulas de Cristal Estilo Apple) */}
        {subjects.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjPillsScroll}
          >
            <Pressable
              onPress={() => {
                triggerHaptic('selection')
                setSelectedSubjectId('all')
              }}
              style={[
                styles.subjPill,
                selectedSubjectId === 'all' && styles.subjPillAllActive,
              ]}
            >
              <Text
                style={[
                  styles.subjPillText,
                  selectedSubjectId === 'all' && styles.subjPillTextAllActive,
                ]}
              >
                Todas ({tasks.length})
              </Text>
            </Pressable>

            {subjects.map((s) => {
              const isSelected = selectedSubjectId === s.id
              const subjColor = s.color || '#FFFFFF'
              const isWhite = subjColor === '#FFFFFF'
              const count = tasks.filter((t) => t.subject_id === s.id).length

              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    triggerHaptic('selection')
                    setSelectedSubjectId(s.id)
                  }}
                  style={[
                    styles.subjPill,
                    isSelected && {
                      backgroundColor: isWhite
                        ? 'rgba(255, 255, 255, 0.2)'
                        : `${subjColor}28`,
                      borderColor: isWhite
                        ? 'rgba(255, 255, 255, 0.45)'
                        : `${subjColor}70`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: subjColor },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text
                    style={[
                      styles.subjPillText,
                      isSelected && styles.subjPillTextActive,
                    ]}
                  >
                    {s.name} {count > 0 ? `(${count})` : ''}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        {/* Segmented Control iOS para Estado (Pendientes / Completadas / Todas) */}
        <View style={styles.segmentedControl}>
          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              setStatusFilter('pending')
            }}
            style={[
              styles.segmentBtn,
              statusFilter === 'pending' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                statusFilter === 'pending' && styles.segmentTextActive,
              ]}
            >
              Pendientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              setStatusFilter('completed')
            }}
            style={[
              styles.segmentBtn,
              statusFilter === 'completed' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                statusFilter === 'completed' && styles.segmentTextActive,
              ]}
            >
              Completadas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              setStatusFilter('all')
            }}
            style={[
              styles.segmentBtn,
              statusFilter === 'all' && styles.segmentBtnActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                statusFilter === 'all' && styles.segmentTextActive,
              ]}
            >
              Todas
            </Text>
          </Pressable>
        </View>

        {/* Lista Plana y Abierta Directa en el Canvas (CERO Carditis) */}
        <View style={styles.tasksListWrapper}>
          {filteredTasks.length > 0 ? (
            <View style={styles.openTaskRows}>
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
              <CheckCircle2 size={36} color="#27272A" />
              <Text style={styles.emptyTitle}>
                {statusFilter === 'completed'
                  ? 'No hay tareas completadas'
                  : searchQuery.length > 0
                  ? 'No se encontraron resultados'
                  : '¡Al día! No tienes tareas pendientes'}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery.length > 0
                  ? 'Intenta buscar con otro término o selecciona otra materia.'
                  : 'Toca el botón + flotante para añadir un nuevo pendiente o entrega.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Botón Flotante (+) con Física de Resorte y Haptic Apple */}
      <Animated.View
        style={[
          styles.fabWrapper,
          {
            bottom: Math.max(insets.bottom, 12) + 72,
            transform: [{ scale: fabScaleAnim }],
          },
        ]}
      >
        <Pressable
          onPress={() => {
            triggerHaptic('medium')
            setTaskToEdit(null)
            setShowCreateModal(true)
          }}
          onPressIn={handleFabPressIn}
          onPressOut={handleFabPressOut}
          style={styles.fab}
        >
          <Plus size={22} color="#09090B" strokeWidth={2.8} />
        </Pressable>
      </Animated.View>

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

      {/* Modal de Creación */}
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  header: {
    gap: 3,
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    height: 42,
  },
  searchBarFocused: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  clearSearchBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjPillsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  subjPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  subjPillAllActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  subjPillText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  subjPillTextAllActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  subjPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 3,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  segmentText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tasksListWrapper: {
    marginTop: 6,
  },
  openTaskRows: {
    // Lista 100% abierta sobre el canvas nativo (CERO card envolvente)
    paddingHorizontal: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    gap: 8,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 14.5,
    fontWeight: '600',
  },
  emptySub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 36,
    lineHeight: 17,
  },
  fabWrapper: {
    position: 'absolute',
    right: 20,
    zIndex: 99,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
})
