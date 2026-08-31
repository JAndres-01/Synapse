import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Task } from '@/types/personal'
import { Check, Paperclip, Clock } from 'lucide-react-native'
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

  return (
    <View style={[styles.rowContainer, !isLast && styles.rowBorder]}>
      {/* Checkbox Circular */}
      <Pressable
        onPress={() => {
          triggerHaptic(isDone ? 'light' : 'success')
          onToggleStatus(task.id, task.status)
        }}
        style={[styles.checkbox, isDone && styles.checkboxDone]}
        hitSlop={10}
      >
        {isDone && <Check size={11} color="#09090B" strokeWidth={3} />}
      </Pressable>

      {/* Contenido de la Tarea */}
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onOpenDetail(task)
        }}
        style={styles.contentArea}
      >
        <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          {task.subject && (
            <View style={styles.subjectTag}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: task.subject.color || '#6366F1' },
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
              <Paperclip size={10} color="#71717A" />
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
  )
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
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
    gap: 3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  subjectName: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '500',
  },
  typeTag: {
    color: '#71717A',
    fontSize: 10.5,
    textTransform: 'capitalize',
  },
  attachTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  attachCount: {
    color: '#71717A',
    fontSize: 10,
  },
  dueText: {
    color: '#71717A',
    fontSize: 11,
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
