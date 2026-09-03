import React, { useRef, useEffect, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Easing,
} from 'react-native'
import type { Task } from '@/types/personal'
import { Check, Paperclip, Edit2, Trash2, RotateCcw } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)
const ACTION_BUTTON_WIDTH = 56
const TOTAL_ACTIONS_WIDTH = 112
const SWIPE_THRESHOLD = 75

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

  // Microinteracciones de escala y atenuación de la fila
  const scaleAnim = useRef(new Animated.Value(1)).current
  const checkBounceAnim = useRef(new Animated.Value(1)).current
  const rowFadeAnim = useRef(new Animated.Value(isDone ? 0.65 : 1)).current
  const rowSlideAnim = useRef(new Animated.Value(0)).current

  // Animación de Brillo Blanco y Elevación al Resaltar
  const highlightAnim = useRef(new Animated.Value(0)).current
  const liftAnim = useRef(new Animated.Value(0)).current

  // Animación de Desplazamiento Horizontal (Gestos estilo Spotify)
  const translateX = useRef(new Animated.Value(0)).current
  const rightSwipeDistance = useRef(new Animated.Value(0)).current
  const isOpen = useRef(false)
  const isGreenTriggered = useRef(false)

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

  // Gesto PanResponder con bloqueo estricto de scroll vertical durante el deslizamiento
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
        isGreenTriggered.current = false
      },
      onPanResponderMove: (_, gestureState) => {
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        if (dx > 0) {
          // Deslizar hacia la derecha (Spotify estilo: gris -> verde en rango)
          const dampedDx = dx > 110 ? 110 + (dx - 110) * 0.35 : dx
          translateX.setValue(dampedDx)
          rightSwipeDistance.setValue(dampedDx)

          if (dampedDx >= SWIPE_THRESHOLD && !isGreenTriggered.current) {
            triggerHaptic('medium')
            isGreenTriggered.current = true
          } else if (dampedDx < SWIPE_THRESHOLD && isGreenTriggered.current) {
            isGreenTriggered.current = false
          }
        } else {
          // Deslizar hacia la izquierda (Revelar Editar Azul y Borrar Rojo sin texto)
          const clampedDx = Math.max(-150, dx)
          translateX.setValue(clampedDx)
          rightSwipeDistance.setValue(0)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        onSwipeActiveChange?.(true)
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        if (dx >= SWIPE_THRESHOLD) {
          // Completar / Descompletar disparado: regresar suavemente a 0 y ejecutar acción
          triggerHaptic('success')
          isOpen.current = false
          isGreenTriggered.current = false
          rightSwipeDistance.setValue(0)

          Animated.timing(translateX, {
            toValue: 0,
            duration: 140,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start(() => {
            onToggleStatus(task.id, task.status)
          })
        } else if (dx <= -48) {
          // Desplegar y anclar botones de Editar y Borrar (sin rebote que exponga el fondo)
          triggerHaptic('selection')
          isOpen.current = true
          Animated.timing(translateX, {
            toValue: -TOTAL_ACTIONS_WIDTH,
            duration: 180,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start()
        } else {
          // Restaurar a posición cerrada exactamente en 0 (sin rebote elástico)
          isOpen.current = false
          isGreenTriggered.current = false
          rightSwipeDistance.setValue(0)

          Animated.timing(translateX, {
            toValue: 0,
            duration: 160,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        onSwipeActiveChange?.(true)
        isOpen.current = false
        isGreenTriggered.current = false
        rightSwipeDistance.setValue(0)

        Animated.timing(translateX, {
          toValue: 0,
          duration: 160,
          easing: APPLE_EASING,
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
      Animated.timing(translateX, {
        toValue: 0,
        duration: 160,
        easing: APPLE_EASING,
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
      easing: APPLE_EASING,
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
      easing: APPLE_EASING,
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
        {/* Fondo Base Gris Neutro (Inicial) */}
        <Animated.View
          style={[
            styles.swipeLeftBackgroundGrey,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 10, 30],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />

        {/* Fondo Verde de Rango Activo (Al alcanzar el umbral de 75px) */}
        <Animated.View
          style={[
            styles.swipeLeftBackgroundGreen,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 68, SWIPE_THRESHOLD],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />

        {/* Icono de Palomita Izquierdo con escalado suave */}
        <Animated.View
          style={[
            styles.swipeLeftIconWrapper,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 15, 40],
                outputRange: [0, 0.6, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: rightSwipeDistance.interpolate({
                    inputRange: [0, 40, SWIPE_THRESHOLD, 110],
                    outputRange: [0.7, 0.9, 1.15, 1.25],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {isDone ? (
            <RotateCcw size={19} color="#FFFFFF" strokeWidth={2.8} />
          ) : (
            <Check size={20} color="#FFFFFF" strokeWidth={3.2} />
          )}
        </Animated.View>

        {/* Bloques Azul y Rojo Pegados a la Derecha (Editar y Borrar SOLO ICONOS) */}
        <View style={styles.swipeRightActionsContainer}>
          {/* Botón Editar Azul */}
          <Pressable
            onPress={handleEditPress}
            style={styles.swipeEditBtn}
            hitSlop={6}
          >
            <Edit2 size={19} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          {/* Botón Borrar Rojo */}
          <Pressable
            onPress={handleDeletePress}
            style={styles.swipeDeleteBtn}
            hitSlop={6}
          >
            <Trash2 size={19} color="#FFFFFF" strokeWidth={2.4} />
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
  swipeLeftBackgroundGrey: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#27272A',
    borderRadius: 14,
  },
  swipeLeftBackgroundGreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#10B981',
    borderRadius: 14,
  },
  swipeLeftIconWrapper: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  swipeDeleteBtn: {
    width: ACTION_BUTTON_WIDTH,
    height: '100%',
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
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