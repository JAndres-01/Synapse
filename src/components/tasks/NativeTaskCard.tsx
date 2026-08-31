import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Task } from '@/types/database'
import { Check, Users, Rocket, FileText, User, Lock, Paperclip } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'

interface NativeTaskCardProps {
  task: Task
  currentUserId?: string | null
  onToggleStatus: (taskId: string, currentStatus: string) => Promise<void>
  onOpenDetail: (task: Task) => void
}

export function NativeTaskCard({
  task,
  currentUserId,
  onToggleStatus,
  onOpenDetail,
}: NativeTaskCardProps) {
  const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string; user_id?: string }> }).user_task_status
  const isCompleted = Array.isArray(statuses)
    ? statuses.some((s) => (!currentUserId || s.user_id === currentUserId) && s.status === 'completed')
    : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

  const attachmentsCount = Array.isArray(task.attachments) ? task.attachments.length : 0

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return null
      const now = new Date()
      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()

      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isCompleted) {
        return { text: isToday ? `Hoy • ${timeStr}` : `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${timeStr}`, isOverdue: false }
      }

      if (isPast) {
        return { text: isToday ? `Venció hoy • ${timeStr}` : `Venció • ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`, isOverdue: true }
      }

      if (isToday) {
        return { text: `Hoy • ${timeStr}`, isOverdue: false }
      }

      return { text: `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${timeStr}`, isOverdue: false }
    } catch {
      return null
    }
  }

  const dueInfo = formatDueDate(task.due_date)

  const handleCheck = () => {
    if (!isCompleted) {
      triggerHaptic('success')
    } else {
      triggerHaptic('light')
    }
    onToggleStatus(task.id, isCompleted ? 'completed' : 'pending')
  }

  return (
    <Pressable
      onPress={() => onOpenDetail(task)}
      style={[
        styles.card,
        isCompleted && styles.cardCompleted,
      ]}
    >
      {/* Checkbox circular minimalista */}
      <Pressable
        onPress={handleCheck}
        hitSlop={10}
        style={[
          styles.checkbox,
          isCompleted && styles.checkboxCompleted,
        ]}
      >
        {isCompleted && <Check size={11} color="#09090B" strokeWidth={3} />}
      </Pressable>

      {/* Contenido principal */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            isCompleted && styles.titleCompleted,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {/* Metadatos y badges */}
        <View style={styles.metaRow}>
          {task.subject ? (
            <View
              style={[
                styles.subjectBadge,
                { backgroundColor: `${task.subject.color || '#6366F1'}15` },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: task.subject.color || '#6366F1' },
                ]}
              />
              <Text
                style={[
                  styles.subjectBadgeText,
                  { color: task.subject.color || '#818CF8' },
                ]}
                numberOfLines={1}
              >
                {task.subject.name}
              </Text>
            </View>
          ) : (
            <View style={styles.badgeGeneral}>
              <Text style={styles.badgeGeneralText}>General</Text>
            </View>
          )}

          {task.is_private && (
            <View style={styles.badgePrivate}>
              <Lock size={9} color="#FBBF24" />
              <Text style={styles.badgePrivateText}>Privada</Text>
            </View>
          )}

          {task.type === 'grupal' && (
            <View style={styles.badgeType}>
              <Users size={9} color="#A1A1AA" />
              <Text style={styles.badgeTypeText}>Grupal</Text>
            </View>
          )}

          {task.type === 'proyecto' && (
            <View style={styles.badgeType}>
              <Rocket size={9} color="#A1A1AA" />
              <Text style={styles.badgeTypeText}>Proyecto</Text>
            </View>
          )}

          {task.type === 'examen' && (
            <View style={styles.badgeType}>
              <FileText size={9} color="#A1A1AA" />
              <Text style={styles.badgeTypeText}>Examen</Text>
            </View>
          )}

          {attachmentsCount > 0 && (
            <View style={styles.badgeType}>
              <Paperclip size={9} color="#71717A" />
              <Text style={styles.badgeTypeText}>{attachmentsCount}</Text>
            </View>
          )}

          {dueInfo && (
            <Text
              style={[
                styles.dueText,
                dueInfo.isOverdue && styles.dueTextOverdue,
                isCompleted && styles.dueTextCompleted,
              ]}
            >
              {dueInfo.text}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39, 39, 42, 0.5)',
    gap: 10,
  },
  cardCompleted: {
    opacity: 0.45,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 1.5,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxCompleted: {
    backgroundColor: '#E4E4E7',
    borderColor: '#E4E4E7',
  },
  content: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 18,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    maxWidth: 120,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeGeneral: {
    backgroundColor: '#27272A',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  badgeGeneralText: {
    color: '#A1A1AA',
    fontSize: 9.5,
    fontWeight: '500',
  },
  badgePrivate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(120, 53, 15, 0.3)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  badgePrivateText: {
    color: '#FBBF24',
    fontSize: 9.5,
    fontWeight: '600',
  },
  badgeType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeTypeText: {
    color: '#71717A',
    fontSize: 9.5,
  },
  dueText: {
    color: '#71717A',
    fontSize: 10,
    fontFamily: 'monospace',
    marginLeft: 'auto',
  },
  dueTextOverdue: {
    color: '#F87171',
    fontWeight: '600',
  },
  dueTextCompleted: {
    color: '#52525B',
    textDecorationLine: 'line-through',
  },
})
