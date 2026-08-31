import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import type { Task } from '@/types/personal'
import { Check, Paperclip } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistTaskRowProps {
  task: Task
  isLast?: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onOpenDetail: (task: Task) => void
}

export function MinimalistTaskRow({
  task,
  isLast = false,
  onToggleStatus,
  onOpenDetail,
}: MinimalistTaskRowProps) {
  const isDone = task.status === 'completed'

  // Animación de rebote físico estilo iOS
  const scaleAnim = useRef(new Animated.Value(1)).current
  const checkScaleAnim = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      stiffness: 500,
      damping: 30,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 450,
      damping: 25,
      useNativeDriver: true,
    }).start()
  }

  const handleToggle = () => {
    // Micro-animación de resorte en el checkbox
    Animated.sequence([
      Animated.timing(checkScaleAnim, {
        toValue: 1.25,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(checkScaleAnim, {
        toValue: 1,
        stiffness: 500,
        damping: 20,
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

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <View style={[styles.rowContainer, !isLast && styles.rowBorder]}>
        {/* Checkbox Circular con animación de resorte */}
        <Pressable
          onPress={handleToggle}
          style={styles.checkboxTouchArea}
          hitSlop={12}
        >
          <Animated.View
            style={[
              styles.checkbox,
              isDone && styles.checkboxDone,
              { transform: [{ scale: checkScaleAnim }] },
            ]}
          >
            {isDone && <Check size={11} color="#09090B" strokeWidth={3} />}
          </Animated.View>
        </Pressable>

        {/* Contenido de la Tarea (Abierto en el canvas, sin card envolvente) */}
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

            {task.type !== 'individual' && (
              <Text style={styles.typeTag}>• {task.type}</Text>
            )}

            {attachCount > 0 && (
              <View style={styles.attachTag}>
                <Paperclip size={11} color="#71717A" />
                <Text style={styles.attachCount}>{attachCount}</Text>
              </View>
            )}

            {dueInfo && (
              <Text
                style={[
                  styles.dueText,
                  dueInfo.isPast && styles.dueTextPast,
                  dueInfo.isToday && styles.dueTextToday,
                ]}
              >
                • {dueInfo.text}
              </Text>
            )}
          </View>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  checkboxTouchArea: {
    padding: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    fontSize: 11.5,
    fontWeight: '500',
  },
  typeTag: {
    color: '#71717A',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  attachTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  attachCount: {
    color: '#71717A',
    fontSize: 10.5,
  },
  dueText: {
    color: '#71717A',
    fontSize: 11.5,
  },
  dueTextPast: {
    color: '#F87171',
    fontWeight: '600',
  },
  dueTextToday: {
    color: '#FBBF24',
    fontWeight: '600',
  },
})
