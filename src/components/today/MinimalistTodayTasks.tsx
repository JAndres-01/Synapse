import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import type { Task } from '@/types/personal'
import { Check, CheckSquare, ChevronRight, Clock, Paperclip } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistTodayTasksProps {
  tasks: Task[]
  onToggleTask: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail: (task: Task) => void
  onNavigateToTasks: () => void
}

function TodayTaskItem({
  task,
  isLast,
  onToggle,
  onOpenDetail,
}: {
  task: Task
  isLast: boolean
  onToggle: () => void
  onOpenDetail: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const checkBounceAnim = useRef(new Animated.Value(1)).current
  const isDone = task.status === 'completed'
  const subjColor = task.subject?.color || '#71717A'
  const isWhite = task.subject?.color === '#FFFFFF'
  const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      stiffness: 600,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 22,
      useNativeDriver: true,
    }).start()
  }

  const handleCheckboxToggle = () => {
    Animated.sequence([
      Animated.timing(checkBounceAnim, {
        toValue: 1.45,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(checkBounceAnim, {
        toValue: 0.82,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.spring(checkBounceAnim, {
        toValue: 1,
        stiffness: 900,
        damping: 14,
        useNativeDriver: true,
      }),
    ]).start()

    triggerHaptic(isDone ? 'light' : 'success')
    onToggle()
  }

  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      const isTomorrow = d.toDateString() === tomorrow.toDateString()

      const hours = d.getHours()
      const mins = d.getMinutes().toString().padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedH = hours % 12 || 12

      if (isToday) return { text: `Hoy ${formattedH}:${mins} ${ampm}`, isToday: true }
      if (isTomorrow) return { text: `Mañana ${formattedH}:${mins} ${ampm}`, isToday: false }
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return { text: `${dayNames[d.getDay()]} ${formattedH}:${mins} ${ampm}`, isToday: false }
    } catch {
      return null
    }
  }

  const dueInfo = formatDue(task.due_date)

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.taskRowOuter]}>
      <View style={[styles.taskRow, !isLast && styles.taskRowBorder]}>
        {/* Checkbox Circular con Rebote Rápido */}
        <Animated.View style={{ transform: [{ scale: checkBounceAnim }] }}>
          <Pressable
            onPress={handleCheckboxToggle}
            style={[styles.checkbox, isDone && styles.checkboxDone]}
            hitSlop={8}
          >
            {isDone && <Check size={11} color="#09090B" strokeWidth={3.5} />}
          </Pressable>
        </Animated.View>

        {/* Contenido de la Tarea */}
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onOpenDetail()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.taskContent}
        >
          <Text
            style={[styles.taskTitle, isDone && styles.taskTitleDone]}
            numberOfLines={1}
          >
            {task.title}
          </Text>

          <View style={styles.metaRow}>
            {/* Tag de Materia */}
            <View style={styles.subjectTag}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: subjColor },
                  isWhite && styles.whiteDotBorder,
                ]}
              />
              <Text style={styles.subjectName}>
                {task.subject?.name || 'General'}
              </Text>
            </View>

            {Boolean(dueInfo) && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <View style={[styles.dueItem, dueInfo?.isToday && styles.dueItemToday]}>
                  <Clock size={10.5} color={dueInfo?.isToday ? '#F59E0B' : '#71717A'} />
                  <Text style={[styles.dueText, dueInfo?.isToday && styles.dueTextToday]}>
                    {dueInfo?.text}
                  </Text>
                </View>
              </>
            )}

            {attachCount > 0 && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.dueItem}>
                  <Paperclip size={10} color="#71717A" />
                  <Text style={styles.dueText}>{attachCount}</Text>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </View>
    </Animated.View>
  )
}

export function MinimalistTodayTasks({
  tasks = [],
  onToggleTask,
  onOpenTaskDetail,
  onNavigateToTasks,
}: MinimalistTodayTasksProps) {
  const now = new Date()
  const endOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999).getTime()

  const pendingNext7DaysTasks = tasks.filter((t) => {
    if (t.status !== 'pending') return false
    if (!t.due_date) return true
    try {
      const dueTime = new Date(t.due_date).getTime()
      return dueTime <= endOf7Days
    } catch {
      return true
    }
  })

  const sortedTasks = [...pendingNext7DaysTasks].sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          PENDIENTES PRÓXIMOS ({sortedTasks.length})
        </Text>
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onNavigateToTasks()
          }}
          hitSlop={10}
          style={styles.seeAllBtn}
        >
          <Text style={styles.seeAllText}>Ver todas</Text>
          <ChevronRight size={13} color="#A1A1AA" />
        </Pressable>
      </View>

      {sortedTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CheckSquare size={17} color="#52525B" />
          <Text style={styles.emptyText}>¡Todo al día para los próximos 7 días!</Text>
        </View>
      ) : (
        <View style={styles.taskLinesGroup}>
          {sortedTasks.slice(0, 4).map((task, idx) => (
            <TodayTaskItem
              key={task.id}
              task={task}
              isLast={idx === Math.min(sortedTasks.length, 4) - 1}
              onToggle={() => onToggleTask(task.id, task.status)}
              onOpenDetail={() => onOpenTaskDetail(task)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  taskLinesGroup: {
    paddingHorizontal: 2,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '500',
  },
  taskRowOuter: {
    width: '100%',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  taskRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
  taskContent: {
    flex: 1,
    gap: 3,
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  taskTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
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
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  dueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  dueItemToday: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dueText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '500',
  },
  dueTextToday: {
    color: '#F59E0B',
    fontWeight: '700',
  },
})
