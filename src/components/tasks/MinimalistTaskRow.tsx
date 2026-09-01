import React, { useRef, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import type { Task } from '@/types/personal'
import { Check, Paperclip } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistTaskRowProps {
  task: Task
  isLast?: boolean
  isHighlighted?: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onOpenDetail: (task: Task) => void
}

export function MinimalistTaskRow({
  task,
  isLast = false,
  isHighlighted = false,
  onToggleStatus,
  onOpenDetail,
}: MinimalistTaskRowProps) {
  const isDone = task.status === 'completed'

  // Animaciones de microinteracción táctil, resorte y entrada fluida
  const scaleAnim = useRef(new Animated.Value(1)).current
  const checkBounceAnim = useRef(new Animated.Value(1)).current
  const rowFadeAnim = useRef(new Animated.Value(isDone ? 0.65 : 1)).current
  const rowSlideAnim = useRef(new Animated.Value(0)).current

  // Animación de Brillo Blanco y Elevación al Resaltar
  const highlightAnim = useRef(new Animated.Value(0)).current
  const liftAnim = useRef(new Animated.Value(0)).current

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
          useNativeDriver: false,
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
            useNativeDriver: false,
          }),
        ]).start()
      }, 1600)

      return () => clearTimeout(timer)
    }
  }, [isHighlighted])

  const handlePressIn = () => {
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
    // Animación de rebote elástico en el checkbox
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

  const interpolatedBg = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.12)'],
  })

  const interpolatedBorder = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.35)'],
  })

  return (
    <Animated.View
      style={[
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
      <Animated.View
        style={[
          styles.glowWrapper,
          {
            backgroundColor: interpolatedBg,
            borderColor: interpolatedBorder,
          },
        ]}
      >
        <View style={[styles.rowContainer, !isLast && styles.rowBorder]}>
          {/* Checkbox Circular con animación de rebote elástico */}
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

          {/* Contenido de la Tarea con micro-scale reactivo */}
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onOpenDetail(task)
            }}
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
              {task.subject && (
                <View style={styles.subjectTag}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: task.subject.color || '#FFFFFF' },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.subjectName}>{task.subject.name}</Text>
                </View>
              )}

              {task.subject && dueInfo && <Text style={styles.metaDot}>•</Text>}

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
}

const styles = StyleSheet.create({
  glowWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    marginHorizontal: -8,
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
