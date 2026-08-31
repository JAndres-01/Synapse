import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import type { Task } from '@/types/database'
import { Check, Users, Rocket, FileText, User, Lock, CalendarRange } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'

interface NativeUrgentCarouselProps {
  tasks?: Task[]
  currentUserId?: string | null
  onToggleTaskStatus: (taskId: string, currentStatus: string) => Promise<void>
  onOpenDetail?: (task: Task) => void
  onNavigateToTasks?: () => void
}

export function NativeUrgentCarousel({
  tasks = [],
  currentUserId,
  onToggleTaskStatus,
  onOpenDetail,
  onNavigateToTasks,
}: NativeUrgentCarouselProps) {
  if (!tasks || tasks.length === 0) return null

  const formatDueDate = (dateStr?: string, isCompleted?: boolean) => {
    if (!dateStr) return { text: 'Sin fecha', isOverdue: false, isToday: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: 'Pendiente', isOverdue: false, isToday: false }
      const now = new Date()

      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()

      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isCompleted) {
        return { text: isToday ? `Hoy • ${timeStr}` : `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${timeStr}`, isOverdue: false, isToday: false }
      }

      if (isPast) {
        return { text: isToday ? `Venció hoy • ${timeStr}` : `Venció • ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`, isOverdue: true, isToday }
      }

      if (isToday) {
        return { text: `Hoy • ${timeStr}`, isOverdue: false, isToday: true }
      }

      return { text: `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${timeStr}`, isOverdue: false, isToday: false }
    } catch {
      return { text: 'Pendiente', isOverdue: false, isToday: false }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <CalendarRange size={14} color="#818CF8" />
          <Text style={styles.headerTitle}>Entregas Próximas</Text>
        </View>
        {onNavigateToTasks && (
          <Pressable onPress={onNavigateToTasks} hitSlop={8}>
            <Text style={styles.seeAllText}>Ver todas</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tasks.map((task) => {
          const statuses = task.user_status || (task as unknown as { user_task_status?: Array<{ status: string; user_id?: string }> }).user_task_status
          const isCompleted = Array.isArray(statuses)
            ? statuses.some((s) => (!currentUserId || s.user_id === currentUserId) && s.status === 'completed')
            : Boolean(statuses && (statuses as { status?: string }).status === 'completed')

          const dueInfo = formatDueDate(task.due_date, isCompleted)

          const handleCheck = () => {
            if (!isCompleted) {
              triggerHaptic('success')
            } else {
              triggerHaptic('light')
            }
            onToggleTaskStatus(task.id, isCompleted ? 'completed' : 'pending')
          }

          return (
            <Pressable
              key={task.id}
              onPress={() => {
                triggerHaptic('light')
                onOpenDetail?.(task)
              }}
              style={[
                styles.taskCard,
                isCompleted && styles.taskCardCompleted,
              ]}
            >
              {/* Header: Badge y Fecha */}
              <View style={styles.cardHeader}>
                {task.is_private ? (
                  <View style={styles.badgePrivate}>
                    <Lock size={9} color="#FBBF24" />
                    <Text style={styles.badgePrivateText}>Privada</Text>
                  </View>
                ) : task.subject ? (
                  <View
                    style={[
                      styles.subjectPill,
                      { backgroundColor: `${task.subject.color || '#6366F1'}20` },
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
                        styles.subjectPillText,
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

                <Text
                  style={[
                    styles.dueText,
                    dueInfo.isOverdue && styles.dueTextOverdue,
                    dueInfo.isToday && styles.dueTextToday,
                    isCompleted && styles.dueTextCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {dueInfo.text}
                </Text>
              </View>

              {/* Título y Checkbox */}
              <View style={styles.cardBottom}>
                <Pressable
                  onPress={handleCheck}
                  hitSlop={8}
                  style={[
                    styles.checkbox,
                    isCompleted && styles.checkboxCompleted,
                  ]}
                >
                  {isCompleted && <Check size={11} color="#09090B" strokeWidth={3} />}
                </Pressable>

                <Text
                  style={[
                    styles.taskTitle,
                    isCompleted && styles.taskTitleCompleted,
                  ]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  seeAllText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '600',
  },
  scrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  taskCard: {
    width: 230,
    backgroundColor: 'rgba(24, 24, 27, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    gap: 10,
  },
  taskCardCompleted: {
    opacity: 0.5,
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 110,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  subjectPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgePrivate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(120, 53, 15, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePrivateText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '600',
  },
  badgeGeneral: {
    backgroundColor: '#27272A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGeneralText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '500',
  },
  dueText: {
    color: '#71717A',
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  dueTextOverdue: {
    color: '#F87171',
    fontWeight: '600',
  },
  dueTextToday: {
    color: '#E4E4E7',
    fontWeight: '600',
  },
  dueTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#52525B',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#71717A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxCompleted: {
    backgroundColor: '#E4E4E7',
    borderColor: '#E4E4E7',
  },
  taskTitle: {
    color: '#F4F4F5',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    flex: 1,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
})
