import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Schedule, Subject } from '@/types/personal'
import { X, Check, Clock, Plus, CheckCircle2, Paperclip, Calendar } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistDayTasksModalProps {
  visible: boolean
  day: number // 1: Lun ... 5: Vie
  schedules: Schedule[]
  tasks: Task[]
  onClose: () => void
  onToggleTaskStatus: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail: (task: Task) => void
  onCreateTaskForDay?: (day: number) => void
}

const DAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
}

export function MinimalistDayTasksModal({
  visible,
  day,
  schedules = [],
  tasks = [],
  onClose,
  onToggleTaskStatus,
  onOpenTaskDetail,
  onCreateTaskForDay,
}: MinimalistDayTasksModalProps) {
  const insets = useSafeAreaInsets()

  // Animaciones del Modal y Gesto de Deslizar
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const panY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(visible)

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      panY.setValue(0)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          stiffness: 480,
          damping: 32,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(panY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
      })
    }
  }, [visible, fadeAnim, slideAnim])

  const handleSmoothClose = () => {
    triggerHaptic('light')
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(panY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose()
    })
  }

  // PanResponder Robusto para Deslizar Hacia Abajo y Cerrar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.35) {
          handleSmoothClose()
        } else {
          Animated.spring(panY, {
            toValue: 0,
            damping: 22,
            stiffness: 400,
            useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, {
          toValue: 0,
          damping: 22,
          stiffness: 400,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  if (!modalVisible) return null

  // Obtener las materias programadas en este día
  const daySubjectIds = new Set(
    schedules
      .filter((s) => s.day_of_week === day && s.subject_id)
      .map((s) => s.subject_id)
  )

  // Filtrar tareas que pertenecen a este día (por due_date o por materias del día)
  const dayTasks = tasks.filter((t) => {
    if (t.due_date) {
      try {
        const taskDay = new Date(t.due_date).getDay()
        if (taskDay === day) return true
      } catch {}
    }
    if (t.subject_id && daySubjectIds.has(t.subject_id)) {
      return true
    }
    return false
  })

  // Ordenar: pendientes primero, luego por urgencia
  const sortedDayTasks = [...dayTasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1
    }
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })

  const pendingCount = sortedDayTasks.filter((t) => t.status === 'pending').length
  const dayName = DAY_NAMES[day] || 'Día'

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop Estático */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: slideAnim }, { translateY: panY }],
            },
          ]}
        >
          {/* Header con PanResponder */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View>
                <View style={styles.titleWithBadgeRow}>
                  <Text style={styles.sheetTitle}>Tareas de {dayName}</Text>
                  {pendingCount > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{pendingCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sheetSubtitle}>
                  {sortedDayTasks.length === 0
                    ? 'Sin pendientes registrados para este día'
                    : `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} • ${sortedDayTasks.length - pendingCount} completada${sortedDayTasks.length - pendingCount === 1 ? '' : 's'}`}
                </Text>
              </View>

              <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>

          {/* Lista de Tareas del Día */}
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sortedDayTasks.length > 0 ? (
              <View style={styles.tasksList}>
                {sortedDayTasks.map((t) => {
                  const isDone = t.status === 'completed'
                  const isWhite = t.subject?.color === '#FFFFFF'
                  const attachCount = Array.isArray(t.attachments) ? t.attachments.length : 0

                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        triggerHaptic('light')
                        onOpenTaskDetail(t)
                      }}
                      style={[styles.taskItemCard, isDone && styles.taskItemCardDone]}
                    >
                      {/* Checkbox Circular */}
                      <Pressable
                        onPress={() => {
                          triggerHaptic(isDone ? 'selection' : 'success')
                          onToggleTaskStatus(t.id, t.status)
                        }}
                        hitSlop={10}
                        style={styles.checkboxArea}
                      >
                        <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                          {isDone && <Check size={10} color="#09090B" strokeWidth={3.5} />}
                        </View>
                      </Pressable>

                      {/* Contenido de la Tarea */}
                      <View style={styles.taskItemContent}>
                        <Text
                          style={[styles.taskItemTitle, isDone && styles.taskItemTitleDone]}
                          numberOfLines={2}
                        >
                          {t.title}
                        </Text>

                        <View style={styles.taskItemMetaRow}>
                          {t.subject && (
                            <View style={styles.taskSubjTag}>
                              <View
                                style={[
                                  styles.subjDot,
                                  { backgroundColor: t.subject.color || '#FFFFFF' },
                                  isWhite && styles.whiteDotBorder,
                                ]}
                              />
                              <Text style={styles.taskSubjName}>{t.subject.name}</Text>
                            </View>
                          )}

                          {t.subject && t.due_date && <Text style={styles.metaDot}>•</Text>}

                          {t.due_date && (
                            <View style={styles.metaDueTag}>
                              <Clock size={10.5} color="#71717A" />
                              <Text style={styles.metaDueText}>
                                {new Date(t.due_date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          )}

                          {attachCount > 0 && (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <View style={styles.metaDueTag}>
                                <Paperclip size={10} color="#71717A" />
                                <Text style={styles.metaDueText}>{attachCount}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                <CheckCircle2 size={36} color="#27272A" />
                <Text style={styles.emptyStateTitle}>¡Al día con las tareas de {dayName}!</Text>
                <Text style={styles.emptyStateSub}>
                  No tienes entregas ni tareas pendientes vinculadas a las clases de este día.
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0F0F13',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: '88%',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#52525B',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  countBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6.5,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  countBadgeText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    paddingHorizontal: 20,
  },
  sheetScrollContent: {
    paddingTop: 14,
    paddingBottom: 24,
  },
  tasksList: {
    gap: 8,
  },
  taskItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
    gap: 12,
  },
  taskItemCardDone: {
    opacity: 0.55,
  },
  checkboxArea: {
    paddingTop: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  taskItemContent: {
    flex: 1,
    gap: 4,
  },
  taskItemTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  taskItemTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  taskItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  taskSubjTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  subjDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  taskSubjName: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  metaDueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  metaDueText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateSub: {
    color: '#71717A',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
})
