import React, { useRef, useEffect, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import type { Task } from '@/types/personal'
import { Check, Paperclip, Edit2, Trash2, RotateCcw } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const ACTION_BUTTON_WIDTH = 70
const TOTAL_ACTIONS_WIDTH = 140

interface MinimalistTaskRowProps {
  task: Task
  isLast?: boolean
  isHighlighted?: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onOpenDetail: (task: Task) => void
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  onSwipeActiveChange?: (isActive: boolean) => void
}

export const MinimalistTaskRow = memo(function MinimalistTaskRow({
  task,
  isLast = false,
  isHighlighted = false,
  onToggleStatus,
  onOpenDetail,
  onEdit,
  onDelete,
  onSwipeActiveChange,
}: MinimalistTaskRowProps) {
  const isDone = task.status === 'completed'

  // Animaciones de escala tactil, rebote y opacidad
  const scaleAnim = useRef(new Animated.Value(1)).current
  const checkBounceAnim = useRef(new Animated.Value(1)).current
  const rowFadeAnim = useRef(new Animated.Value(isDone ? 0.65 : 1)).current
  const rowSlideAnim = useRef(new Animated.Value(0)).current

  // Animacion de Brillo Blanco y Elevacion al Resaltar
  const highlightAnim = useRef(new Animated.Value(0)).current
  const liftAnim = useRef(new Animated.Value(0)).current

  // Animacion de Desplazamiento Horizontal (Gestos estilo Spotify)
  const translateX = useRef(new Animated.Value(0)).current
  const rightSwipeProgress = useRef(new Animated.Value(0)).current
  const isOpen = useRef(false)
  const hasTriggeredHaptic = useRef(false)

  useEffect(() => {
    Animated.timing(rowFadeAnim, {
      toValue: isDone ? 0.6 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [isDone])

  useEffect(() => {
    if (isHighlighted) {
      triggerHaptic('medium')
      liftAnim.setValue(0)
      highlightAnim.setValue(0)
      Animated.parallel([
        Animated.spring(liftAnim, {
          toValue: -5,
          stiffness: 450,
          damping: 18,
          useNativeDriver: true,
        }),
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(liftAnim, {
            toValue: 0,
            stiffness: 280,
            damping: 24,
            useNativeDriver: true,
          }),
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]).start()
      }, 1600)

      return () => clearTimeout(timer)
    } else {
      liftAnim.setValue(0)
      highlightAnim.setValue(0)
    }
  }, [isHighlighted])

  // Gesto PanResponder con bloqueo estricto de scroll vertical mientras se desliza horizontalmente
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3
        )
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3
        )
      },
      onPanResponderGrant: () => {
        onSwipeActiveChange?.(false)
        hasTriggeredHaptic.current = false
      },
      onPanResponderMove: (_, gestureState) => {
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        if (dx > 0) {
          // Deslizar hacia la derecha (Spotify estilo Verde: Marcar completada/pendiente)
          const dampedDx = dx > 120 ? 120 + (dx - 120) * 0.35 : dx
          translateX.setValue(dampedDx)
          rightSwipeProgress.setValue(dampedDx)

          if (dampedDx >= 75 && !hasTriggeredHaptic.current) {
            triggerHaptic('medium')
            hasTriggeredHaptic.current = true
          } else if (dampedDx < 75 && hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = false
          }
        } else {
          // Deslizar hacia la izquierda (Revelar Editar Azul y Borrar Rojo)
          const clampedDx = Math.max(-170, dx)
          translateX.setValue(clampedDx)
          rightSwipeProgress.setValue(0)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        onSwipeActiveChange?.(true)
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        if (dx >= 75) {
          // Completar / Descompletar disparado con animacion de salida fluida
          triggerHaptic('success')
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0)
            rightSwipeProgress.setValue(0)
            isOpen.current = false
            onToggleStatus(task.id, task.status)
          })
        } else if (dx <= -55) {
          // Desplegar y anclar botones de Editar y Borrar
          triggerHaptic('selection')
          isOpen.current = true
          Animated.spring(translateX, {
            toValue: -TOTAL_ACTIONS_WIDTH,
            stiffness: 500,
            damping: 28,
            mass: 0.8,
            useNativeDriver: true,
          }).start()
        } else {
          // Restaurar a posicion cerrada
          isOpen.current = false
          rightSwipeProgress.setValue(0)
          Animated.spring(translateX, {
            toValue: 0,
            stiffness: 500,
            damping: 28,
            mass: 0.8,
            useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        onSwipeActiveChange?.(true)
        isOpen.current = false
        rightSwipeProgress.setValue(0)
        Animated.spring(translateX, {
          toValue: 0,
          stiffness: 500,
          damping: 28,
          mass: 0.8,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  const handlePressIn = () => {
    if (isOpen.current) return
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      stiffness: 600,
      damping: 28,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(checkBounceAnim, {
        toValue: 1.35,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(checkBounceAnim, {
        toValue: 0.88,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(checkBounceAnim, {
        toValue: 1,
        stiffness: 600,
        damping: 18,
        useNativeDriver: true,
      }),
    ]).start()

    triggerHaptic(isDone ? 'selection' : 'success')
    onToggleStatus(task.id, task.status)
  }

  const handleCardPress = () => {
    if (isOpen.current) {
      triggerHaptic('light')
      isOpen.current = false
      Animated.spring(translateX, {
        toValue: 0,
        stiffness: 500,
        damping: 28,
        mass: 0.8,
        useNativeDriver: true,
      }).start()
      return
    }
    triggerHaptic('light')
    onOpenDetail(task)
  }

  const handleEditPress = () => {
    triggerHaptic('light')
    isOpen.current = false
    Animated.timing(translateX, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      onEdit?.(task)
    })
  }

  const handleDeletePress = () => {
    triggerHaptic('medium')
    isOpen.current = false
    Animated.timing(translateX, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      onDelete?.(task.id)
    })
  }

  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      const now = new Date()
      const isPast = d.getTime() < now.getTime()
      const isToday = d.toDateString() === now.toDateString()

      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const dayName = days[d.getDay()]
      const hours = d.getHours()
      const mins = String(d.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedH = hours % 12 || 12

      if (isToday) return { text: `Hoy ${formattedH}:${mins} ${ampm}`, isPast: false, isToday: true }
      if (isPast && !isDone) return { text: `Venció ${dayName}`, isPast: true, isToday: false }
      return { text: `${dayName} ${formattedH}:${mins} ${ampm}`, isPast: false, isToday: false }
    } catch {
      return null
    }
  }

  const dueInfo = formatDue(task.due_date)
  const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0
  const isWhite = task.subject?.color === '#FFFFFF'

  return (
    <Animated.View
      style={[
        styles.rowWrapper,
        {
          transform: [
            { scale: scaleAnim },
            { translateY: rowSlideAnim },
            { translateY: liftAnim },
          ],
          opacity: rowFadeAnim,
        },
      ]}
    >
      {/* 1. Capa de Fondo para Gestos estilo Spotify */}
      <View style={styles.swipeBackgroundContainer}>
        {/* Fondo Verde Completo Izquierda (Completar / Descompletar) */}
        <Animated.View
          style={[
            styles.swipeLeftBackground,
            {
              opacity: rightSwipeProgress.interpolate({
                inputRange: [0, 15, 75],
                outputRange: [0, 0.6, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.swipeActionLeftContent,
              {
                transform: [
                  {
                    scale: rightSwipeProgress.interpolate({
                      inputRange: [0, 40, 75, 120],
                      outputRange: [0.6, 0.85, 1.15, 1.25],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            {isDone ? (
              <RotateCcw size={20} color="#FFFFFF" strokeWidth={2.8} />
            ) : (
              <Check size={22} color="#FFFFFF" strokeWidth={3.2} />
            )}
            <Text style={styles.swipeActionLeftText}>
              {isDone ? 'Marcar Pendiente' : 'Completar Tarea'}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Bloques Azul y Rojo Pegados a la Derecha (Editar y Borrar) */}
        <View style={styles.swipeRightActionsContainer}>
          {/* Boton Editar Azul */}
          <Pressable onPress={handleEditPress} style={styles.swipeEditBtn}>
            <Edit2 size={17} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.swipeActionText}>Editar</Text>
          </Pressable>

          {/* Boton Borrar Rojo */}
          <Pressable onPress={handleDeletePress} style={styles.swipeDeleteBtn}>
            <Trash2 size={17} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.swipeActionText}>Borrar</Text>
          </Pressable>
        </View>
      </View>

      {/* 2. Capa Frontal Deslizable (La Tarjeta de la Tarea) */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.glowWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.highlightOverlay, { opacity: highlightAnim }]}
        />
        <View style={[styles.rowContainer, !isLast && styles.rowBorder]}>
          {/* Checkbox Circular */}
          <Pressable
            onPress={handleToggle}
            style={styles.checkboxTouchArea}
            hitSlop={12}
          >
            <Animated.View
              style={[
                styles.checkbox,
                isDone && styles.checkboxDone,
                { transform: [{ scale: checkBounceAnim }] },
              ]}
            >
              {isDone && <Check size={11} color="#09090B" strokeWidth={3.5} />}
            </Animated.View>
          </Pressable>

          {/* Contenido de la Tarea */}
          <Pressable
            onPress={handleCardPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.contentArea}
          >
            <Text
              style={[styles.title, isDone && styles.titleDone]}
              numberOfLines={2}
            >
              {task.title}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.subjectTag}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: task.subject?.color || '#71717A' },
                    task.subject?.color === '#FFFFFF' && styles.whiteDotBorder,
                  ]}
                />
                <Text style={styles.subjectName}>{task.subject?.name || 'General'}</Text>
              </View>

              {dueInfo && <Text style={styles.metaDot}>•</Text>}

              {dueInfo && (
                <Text
                  style={[
                    styles.dueText,
                    dueInfo.isPast && styles.dueTextPast,
                    dueInfo.isToday && styles.dueTextToday,
                    isDone && styles.dueTextDone,
                  ]}
                >
                  {dueInfo.text}
                </Text>
              )}

              {Boolean(task.type) && task.type !== 'individual' && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.typeText}>{task.type}</Text>
                </>
              )}

              {attachCount > 0 && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.attachTag}>
                    <Paperclip size={10} color="#71717A" />
                    <Text style={styles.attachText}>{attachCount}</Text>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  rowWrapper: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeBackgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeLeftBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#10B981',
    borderRadius: 14,
    justifyContent: 'center',
    paddingLeft: 18,
  },
  swipeActionLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeActionLeftText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  swipeRightActionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TOTAL_ACTIONS_WIDTH,
    flexDirection: 'row',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  swipeEditBtn: {
    width: ACTION_BUTTON_WIDTH,
    height: '100%',
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  swipeDeleteBtn: {
    width: ACTION_BUTTON_WIDTH,
    height: '100%',
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  glowWrapper: {
    backgroundColor: '#09090B',
    borderRadius: 14,
    paddingHorizontal: 8,
    position: 'relative',
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  checkboxTouchArea: {
    paddingTop: 3,
    paddingRight: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  contentArea: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  subjectName: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  dueText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  dueTextToday: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dueTextPast: {
    color: '#EF4444',
    fontWeight: '600',
  },
  dueTextDone: {
    color: '#52525B',
  },
  typeText: {
    color: '#71717A',
    fontSize: 11.5,
    textTransform: 'capitalize',
  },
  attachTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  attachText: {
    color: '#71717A',
    fontSize: 11.5,
  },
})