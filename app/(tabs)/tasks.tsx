import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
  LayoutChangeEvent,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
  InteractionManager,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
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
import {
  cancelTaskReminder,
  scheduleTaskReminder,
  syncAllNotifications,
} from '@/lib/personalNotifications'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets()
  const { user } = usePersonalAuth()

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => {
    const cachedTasks = personalStorage.getCachedTasks()
    const cachedSubjs = personalStorage.getCachedSubjects()
    return cachedTasks.map((t) => {
      if (!t.subject_id) {
        return { ...t, subject: null }
      }
      const foundSubj = cachedSubjs.find((s) => s.id === t.subject_id)
      return {
        ...t,
        subject: foundSubj || null,
        subject_id: foundSubj ? t.subject_id : null,
      }
    })
  })

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')

  useEffect(() => {
    if (!searchQuery) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 120)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Estado del Buscador Dinámico
  const [isSearchActive, setIsSearchActive] = useState(false)
  const searchInputRef = useRef<TextInput>(null)
  const searchScaleAnim = useRef(new Animated.Value(0.9)).current
  const searchOpacityAnim = useRef(new Animated.Value(0)).current

  // Estado del Menú de Filtro de Materia
  const [showSubjectMenu, setShowSubjectMenu] = useState(false)
  const [subjMenuVisible, setSubjMenuVisible] = useState(false)
  const menuFadeAnim = useRef(new Animated.Value(0)).current
  const menuSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  // Disparador de Confetti
  const [confettiBurstTrigger, setConfettiBurstTrigger] = useState(0)

  // Modal Unificado de Tareas (Detalle, Crear y Editar en una sola arquitectura)
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // IDs de tareas en transición animada
  const [transitioningTaskIds, setTransitioningTaskIds] = useState<string[]>([])
  const [isScrollEnabled, setIsScrollEnabled] = useState(true)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  // Segmented Control
  const [segmentContainerWidth, setSegmentContainerWidth] = useState(SCREEN_WIDTH - 32)
  const segmentWidth = Math.max(0, (segmentContainerWidth - 6) / 3)
  const statusIndex = statusFilter === 'pending' ? 0 : statusFilter === 'completed' ? 1 : 2
  const slideAnim = useRef(new Animated.Value(0)).current

  // FAB animation
  const fabScaleAnim = useRef(new Animated.Value(1)).current

  const loadData = useCallback(async () => {
    const [cachedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getTasks(),
      personalStorage.getSubjects(),
    ])

    // Resolver materias actualizadas para todas las tareas (si la materia fue eliminada pasa a General)
    const resolvedTasks = cachedTasks.map((t) => {
      if (!t.subject_id) {
        return { ...t, subject: null }
      }
      const foundSubj = cachedSubjs.find((s) => s.id === t.subject_id)
      return {
        ...t,
        subject: foundSubj || null,
        subject_id: foundSubj ? t.subject_id : null,
      }
    })

    setTasks(resolvedTasks)
    setSubjects(cachedSubjs)
  }, [])

  // Recargar datos cada vez que la pestaña Tareas entra en pantalla
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadData()
      })
      return () => task.cancel()
    }, [loadData])
  )

  // Estado de Tarea Resaltada (brillo y elevación animada)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)

  const params = useLocalSearchParams<{ taskId?: string; highlightTimestamp?: string }>()

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToPersonalStorage(() => {
      loadData()
    })
    return unsubscribe
  }, [loadData])

  useEffect(() => {
    if (params.taskId && tasks.length > 0) {
      const found = tasks.find((t) => t.id === params.taskId)
      if (found) {
        // Asegurar que la tarea sea visible si ya estaba completada
        if (found.status === 'completed' && statusFilter === 'pending') {
          setStatusFilter('all')
        }
        // Reiniciar estado brevemente para garantizar la animación si es la misma tarea
        setHighlightedTaskId(null)
        const frameTimer = setTimeout(() => {
          setHighlightedTaskId(found.id)
        }, 20)

        const clearTimer = setTimeout(() => {
          setHighlightedTaskId(null)
        }, 2800)

        return () => {
          clearTimeout(frameTimer)
          clearTimeout(clearTimer)
        }
      }
    }
  }, [params.taskId, params.highlightTimestamp, tasks])

  useEffect(() => {
    if (showSubjectMenu) {
      setSubjMenuVisible(true)
      Animated.parallel([
        Animated.timing(menuFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(menuSlideAnim, {
          toValue: 0,
          stiffness: 480,
          damping: 32,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(menuFadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(menuSlideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSubjMenuVisible(false)
      })
    }
  }, [showSubjectMenu, menuFadeAnim, menuSlideAnim])

  useEffect(() => {
    if (!isSearchActive) return

    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (searchQuery.trim() === '') {
        setIsSearchActive(false)
      }
    })

    return () => {
      hideListener.remove()
    }
  }, [isSearchActive, searchQuery])

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: statusIndex * segmentWidth,
      stiffness: 750,
      damping: 28,
      mass: 0.5,
      useNativeDriver: true,
    }).start()
  }, [statusIndex, segmentWidth, slideAnim])

  const handleStatusChange = (newStatus: 'pending' | 'completed' | 'all') => {
    if (newStatus === statusFilter) return
    const targetIdx = newStatus === 'pending' ? 0 : newStatus === 'completed' ? 1 : 2
    Animated.spring(slideAnim, {
      toValue: targetIdx * segmentWidth,
      stiffness: 750,
      damping: 28,
      mass: 0.5,
      useNativeDriver: true,
    }).start()

    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.84 },
    })
    setStatusFilter(newStatus)
  }

  const handleOpenSearch = () => {
    setIsSearchActive(true)
    searchScaleAnim.setValue(0.88)
    searchOpacityAnim.setValue(0)

    Animated.parallel([
      Animated.spring(searchScaleAnim, {
        toValue: 1,
        stiffness: 550,
        damping: 22,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.timing(searchOpacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      searchInputRef.current?.focus()
    })
  }

  const handleCloseSearch = () => {
    Keyboard.dismiss()
    setSearchQuery('')

    Animated.parallel([
      Animated.spring(searchScaleAnim, {
        toValue: 0.9,
        stiffness: 500,
        damping: 24,
        useNativeDriver: true,
      }),
      Animated.timing(searchOpacityAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSearchActive(false)
    })
  }

  const handleToggleStatus = useCallback(async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    if (nextStatus === 'completed') {
      cancelTaskReminder(taskId)
      personalStorage.getPreferences().then((prefs) => {
        if (prefs.confetti_enabled) {
          setConfettiBurstTrigger((prev) => prev + 1)
        }
      })
    } else {
      const taskObj = tasksRef.current.find((t) => t.id === taskId)
      if (taskObj) {
        personalStorage.getPreferences().then((p) =>
          scheduleTaskReminder({ ...taskObj, status: 'pending' }, p)
        )
      }
    }

    if (statusFilter === 'pending' && nextStatus === 'completed') {
      setTransitioningTaskIds((prev) => [...prev, taskId])

      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus as 'pending' | 'completed' } : t
        )
        personalStorage.setTasks(updated)
        return updated
      })

      setTimeout(() => {
        LayoutAnimation.configureNext({
          duration: 220,
          create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.spring, springDamping: 0.84 },
          delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        })
        setTransitioningTaskIds((prev) => prev.filter((id) => id !== taskId))
      }, 160)
    } else if (statusFilter === 'completed' && nextStatus === 'pending') {
      setTransitioningTaskIds((prev) => [...prev, taskId])

      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus as 'pending' | 'completed' } : t
        )
        personalStorage.setTasks(updated)
        return updated
      })

      setTimeout(() => {
        LayoutAnimation.configureNext({
          duration: 220,
          create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.spring, springDamping: 0.84 },
          delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        })
        setTransitioningTaskIds((prev) => prev.filter((id) => id !== taskId))
      }, 160)
    } else {
      LayoutAnimation.configureNext({
        duration: 200,
        update: { type: LayoutAnimation.Types.spring, springDamping: 0.84 },
      })
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus as 'pending' | 'completed' } : t
        )
        personalStorage.setTasks(updated)
        return updated
      })
    }
  }, [statusFilter])

  const handleDeleteTask = useCallback(async (taskId: string) => {
    cancelTaskReminder(taskId)
    LayoutAnimation.configureNext({
      duration: 260,
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.84 },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    })
    setTasks((prevTasks) => {
      const updated = prevTasks.filter((t) => t.id !== taskId)
      personalStorage.setTasks(updated)
      return updated
    })
  }, [])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedSubjectId !== 'all' && task.subject_id !== selectedSubjectId) {
        return false
      }

      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase()
        const matchTitle = task.title?.toLowerCase().includes(q)
        const matchSubj = task.subject?.name?.toLowerCase().includes(q)
        if (!matchTitle && !matchSubj) return false
      }

      const isTransitioning = transitioningTaskIds.includes(task.id)
      if (statusFilter === 'pending') {
        if (task.status === 'completed' && !isTransitioning) return false
      }
      if (statusFilter === 'completed') {
        if (task.status !== 'completed' && !isTransitioning) return false
      }

      return true
    }).sort((a, b) => {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      }
      if (a.due_date && !b.due_date) return -1
      if (!a.due_date && b.due_date) return 1
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
  }, [tasks, selectedSubjectId, debouncedQuery, statusFilter, transitioningTaskIds])

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
      <MinimalistConfetti burstTrigger={confettiBurstTrigger} />

      <ScrollView
        style={styles.scrollView}
        scrollEnabled={isScrollEnabled}
        bounces={true}
        alwaysBounceVertical={true}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 105 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
      >
        {!isSearchActive ? (
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.title}>Tareas</Text>
                <Text style={styles.subtitle}>Entregas, exámenes y pendientes</Text>
              </View>

              <Pressable
                onPress={handleOpenSearch}
                style={styles.searchIconButton}
                hitSlop={10}
              >
                <Search size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.dynamicSearchContainer,
              {
                opacity: searchOpacityAnim,
                transform: [{ scale: searchScaleAnim }],
              },
            ]}
          >
            <View style={styles.dynamicSearchInputWrapper}>
              <Search size={15} color="#A1A1AA" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                placeholder="Buscar por tarea o materia..."
                placeholderTextColor="#71717A"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => Keyboard.dismiss()}
                style={styles.dynamicSearchInput}
                returnKeyType="search"
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

            <Pressable
              onPress={handleCloseSearch}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.cancelSearchBtn}
            >
              <Text style={styles.cancelSearchText}>Cancelar</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Botón Desplegable para Filtrar por Materia */}
        <View style={styles.filterButtonRow}>
          <Pressable
            onPress={() => {
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

          {selectedSubjectId !== 'all' && (
            <Pressable
              onPress={() => {
                setSelectedSubjectId('all')
              }}
              style={styles.resetFilterBtn}
            >
              <Text style={styles.resetFilterText}>Ver todas</Text>
            </Pressable>
          )}
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
          {/* Indicador Deslizante Suave */}
          <Animated.View
            style={[
              styles.activeSegmentPill,
              {
                width: segmentWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />

          <Pressable
            onPressIn={() => handleStatusChange('pending')}
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
            onPressIn={() => handleStatusChange('completed')}
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
            onPressIn={() => handleStatusChange('all')}
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
        </BlurView>

        {/* Lista Plana y Abierta */}
        <View style={styles.tasksListWrapper}>
          {filteredTasks.length > 0 ? (
            <View style={styles.openTaskRows}>
              {filteredTasks.map((task, idx) => (
                <MinimalistTaskRow
                  key={task.id}
                  task={task}
                  statusFilter={statusFilter}
                  isLast={idx === filteredTasks.length - 1}
                  isHighlighted={highlightedTaskId === task.id}
                  onToggleStatus={handleToggleStatus}
                  onOpenDetail={(t) => {
                    setActiveTask(t)
                    setTaskModalMode('detail')
                  }}
                  onEdit={(t) => {
                    setActiveTask(t)
                    setTaskModalMode('edit')
                  }}
                  onDelete={handleDeleteTask}
                  onSwipeActiveChange={setIsScrollEnabled}
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

      {/* Modal Desplegable de Filtro de Materia */}
      {subjMenuVisible && (
        <Modal
          visible={subjMenuVisible}
          transparent={true}
          animationType="none"
          onRequestClose={() => setShowSubjectMenu(false)}
        >
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.menuBackdrop, { opacity: menuFadeAnim }]}>
              <Pressable
                style={styles.menuBackdropTouch}
                onPress={() => setShowSubjectMenu(false)}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.menuSheet,
                { transform: [{ translateY: menuSlideAnim }] },
              ]}
            >
              <View style={styles.menuHeader}>
                <View style={styles.dragHandle} />
                <Text style={styles.menuTitle}>Filtrar por Materia</Text>
                <Pressable
                  onPress={() => setShowSubjectMenu(false)}
                  hitSlop={12}
                  style={styles.menuCloseBtn}
                >
                  <X size={18} color="#A1A1AA" />
                </Pressable>
              </View>

              <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
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
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Botón Flotante (+) */}
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
            setActiveTask(null)
            setTaskModalMode('create')
          }}
          onPressIn={handleFabPressIn}
          onPressOut={handleFabPressOut}
          style={styles.fab}
        >
          <Plus size={22} color="#09090B" strokeWidth={2.8} />
        </Pressable>
      </Animated.View>

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
          onToggleStatus={handleToggleStatus}
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
  scrollView: {
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
    paddingHorizontal: 6,
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 3,
    height: 42,
    alignItems: 'center',
    overflow: 'hidden',
  },
  activeSegmentPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
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
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  menuBackdropTouch: {
    flex: 1,
  },
  menuSheet: {
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '65%',
    paddingBottom: 36,
  },
  menuHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 6,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  menuCloseBtn: {
    position: 'absolute',
    right: 18,
    top: 14,
    padding: 4,
  },
  menuList: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 5,
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
