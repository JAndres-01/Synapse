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
  Modal,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { supabase } from '@/lib/personalSupabase'
import { personalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import { MinimalistTaskDetailModal } from '@/components/tasks/MinimalistTaskDetailModal'
import { MinimalistCreateTaskModal } from '@/components/tasks/MinimalistCreateTaskModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CheckSquare,
  Plus,
  Search,
  CheckCircle2,
  X,
  SlidersHorizontal,
  ChevronDown,
  Check,
} from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

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

  // Estado del Buscador Dinámico Expandible
  const [isSearchActive, setIsSearchActive] = useState(false)
  const searchInputRef = useRef<TextInput>(null)
  const searchAnim = useRef(new Animated.Value(0)).current

  // Estado del Menú de Filtro de Materia
  const [showSubjectMenu, setShowSubjectMenu] = useState(false)

  // Modales de Tarea
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)

  // Animación del Segmented Control Deslizante
  const [segmentContainerWidth, setSegmentContainerWidth] = useState(SCREEN_WIDTH - 32)
  const segmentWidth = Math.max(0, (segmentContainerWidth - 6) / 3)
  const statusIndex = statusFilter === 'pending' ? 0 : statusFilter === 'completed' ? 1 : 2
  const slideAnim = useRef(new Animated.Value(0)).current

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

  // Animación de deslizamiento de la pastilla activa en el segmented control
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: statusIndex * segmentWidth,
      stiffness: 500,
      damping: 32,
      mass: 0.8,
      useNativeDriver: true,
    }).start()
  }, [statusIndex, segmentWidth, slideAnim])

  const handleStatusChange = (newStatus: 'pending' | 'completed' | 'all') => {
    triggerHaptic('selection')
    setStatusFilter(newStatus)
  }

  // Activar / Desactivar Buscador Dinámico con animación
  const handleOpenSearch = () => {
    triggerHaptic('light')
    setIsSearchActive(true)
    Animated.spring(searchAnim, {
      toValue: 1,
      stiffness: 450,
      damping: 28,
      useNativeDriver: true,
    }).start(() => {
      searchInputRef.current?.focus()
    })
  }

  const handleCloseSearch = () => {
    triggerHaptic('light')
    setSearchQuery('')
    Animated.spring(searchAnim, {
      toValue: 0,
      stiffness: 450,
      damping: 28,
      useNativeDriver: true,
    }).start(() => {
      setIsSearchActive(false)
    })
  }

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

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const isSelectedWhite = selectedSubject?.color === '#FFFFFF'

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
        {/* Cabecera Principal y Barra de Acciones */}
        {!isSearchActive ? (
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitleRow}>
                <CheckSquare size={20} color="#FFFFFF" />
                <Text style={styles.title}>Mis Tareas</Text>
              </View>

              {/* Botón Dinámico de Búsqueda */}
              <Pressable
                onPress={handleOpenSearch}
                style={styles.searchIconButton}
                hitSlop={10}
              >
                <Search size={16} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Entregas, talleres, lecturas y exámenes
            </Text>
          </View>
        ) : (
          /* Buscador Dinámico Expandido con Botón Cancelar */
          <View style={styles.dynamicSearchContainer}>
            <View style={styles.dynamicSearchInputWrapper}>
              <Search size={15} color="#A1A1AA" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                placeholder="Buscar por tarea o materia..."
                placeholderTextColor="#71717A"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.dynamicSearchInput}
                returnKeyType="search"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    triggerHaptic('selection')
                    setSearchQuery('')
                  }}
                  hitSlop={10}
                  style={styles.clearSearchBtn}
                >
                  <X size={12} color="#FFFFFF" />
                </Pressable>
              )}
            </View>

            <Pressable onPress={handleCloseSearch} style={styles.cancelSearchBtn}>
              <Text style={styles.cancelSearchText}>Cancelar</Text>
            </Pressable>
          </View>
        )}

        {/* Botón Desplegable para Filtrar por Materia */}
        <View style={styles.filterButtonRow}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setShowSubjectMenu(true)
            }}
            style={[
              styles.subjectDropdownButton,
              selectedSubjectId !== 'all' && {
                borderColor: isSelectedWhite
                  ? '#FFFFFF'
                  : selectedSubject?.color || '#FFFFFF',
                backgroundColor: isSelectedWhite
                  ? 'rgba(255, 255, 255, 0.15)'
                  : `${selectedSubject?.color || '#FFFFFF'}1F`,
              },
            ]}
          >
            <View style={styles.dropdownBtnLeft}>
              <SlidersHorizontal size={13} color="#A1A1AA" />
              {selectedSubject ? (
                <View style={styles.selectedSubjectInfo}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: selectedSubject.color || '#FFFFFF' },
                      isSelectedWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.dropdownBtnTextActive} numberOfLines={1}>
                    {selectedSubject.name}
                  </Text>
                </View>
              ) : (
                <Text style={styles.dropdownBtnText}>Todas las materias</Text>
              )}
            </View>

            <ChevronDown size={14} color="#A1A1AA" />
          </Pressable>

          {/* Tag de reinicio rápido si hay un filtro aplicado */}
          {selectedSubjectId !== 'all' && (
            <Pressable
              onPress={() => {
                triggerHaptic('selection')
                setSelectedSubjectId('all')
              }}
              style={styles.resetFilterBtn}
            >
              <Text style={styles.resetFilterText}>Ver todas</Text>
            </Pressable>
          )}
        </View>

        {/* Segmented Control iOS con Pastilla Deslizante (120 FPS GPU Spring) */}
        <View
          style={styles.segmentedContainer}
          onLayout={(e: LayoutChangeEvent) => {
            setSegmentContainerWidth(e.nativeEvent.layout.width)
          }}
        >
          {/* Pastilla Activa Deslizante */}
          <Animated.View
            style={[
              styles.activeSegmentPill,
              {
                width: segmentWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />

          {/* Botones de Selección */}
          <Pressable
            onPress={() => handleStatusChange('pending')}
            style={styles.segmentButton}
          >
            <Text
              style={[
                styles.segmentButtonText,
                statusFilter === 'pending' && styles.segmentButtonTextActive,
              ]}
            >
              Pendientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleStatusChange('completed')}
            style={styles.segmentButton}
          >
            <Text
              style={[
                styles.segmentButtonText,
                statusFilter === 'completed' && styles.segmentButtonTextActive,
              ]}
            >
              Completadas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleStatusChange('all')}
            style={styles.segmentButton}
          >
            <Text
              style={[
                styles.segmentButtonText,
                statusFilter === 'all' && styles.segmentButtonTextActive,
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

      {/* Modal Desplegable de Selección de Materia Estilo Apple Sheet */}
      <Modal
        visible={showSubjectMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSubjectMenu(false)}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={styles.menuBackdropTouch}
            onPress={() => setShowSubjectMenu(false)}
          />

          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <View style={styles.dragHandle} />
              <Text style={styles.menuTitle}>Filtrar por Materia</Text>
              <Pressable
                onPress={() => setShowSubjectMenu(false)}
                hitSlop={10}
                style={styles.menuCloseBtn}
              >
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>

            <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
              {/* Opción Todas */}
              <Pressable
                onPress={() => {
                  triggerHaptic('selection')
                  setSelectedSubjectId('all')
                  setShowSubjectMenu(false)
                }}
                style={[
                  styles.menuItem,
                  selectedSubjectId === 'all' && styles.menuItemActive,
                ]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.dot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={styles.menuItemText}>Todas las materias</Text>
                  <Text style={styles.menuItemCount}>({tasks.length})</Text>
                </View>

                {selectedSubjectId === 'all' && (
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </Pressable>

              {/* Lista de Materias Registradas */}
              {subjects.map((subj) => {
                const isSelected = selectedSubjectId === subj.id
                const isWhite = subj.color === '#FFFFFF'
                const count = tasks.filter((t) => t.subject_id === subj.id).length

                return (
                  <Pressable
                    key={subj.id}
                    onPress={() => {
                      triggerHaptic('selection')
                      setSelectedSubjectId(subj.id)
                      setShowSubjectMenu(false)
                    }}
                    style={[
                      styles.menuItem,
                      isSelected && styles.menuItemActive,
                    ]}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: subj.color || '#FFFFFF' },
                          isWhite && styles.whiteDotBorder,
                        ]}
                      />
                      <Text style={styles.menuItemText}>{subj.name}</Text>
                      <Text style={styles.menuItemCount}>({count})</Text>
                    </View>

                    {isSelected && (
                      <Check
                        size={16}
                        color={subj.color || '#FFFFFF'}
                        strokeWidth={2.5}
                      />
                    )}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    gap: 2,
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
  },
  searchIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dynamicSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  dynamicSearchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  dynamicSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
  },
  clearSearchBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSearchBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  cancelSearchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dropdownBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectedSubjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dropdownBtnText: {
    color: '#D4D4D8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  dropdownBtnTextActive: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  resetFilterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  resetFilterText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  segmentedContainer: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 3,
    height: 40,
    alignItems: 'center',
  },
  activeSegmentPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentButtonText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  tasksListWrapper: {
    marginTop: 4,
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  menuBackdropTouch: {
    flex: 1,
  },
  menuSheet: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: '#27272A',
    maxHeight: '65%',
    paddingBottom: 32,
  },
  menuHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 8,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  menuCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 14,
    padding: 4,
  },
  menuList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  menuItemCount: {
    color: '#71717A',
    fontSize: 12,
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
