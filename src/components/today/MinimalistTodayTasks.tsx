import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Task } from '@/types/personal'
import { Check, CheckCircle2, ChevronRight } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistTodayTasksProps {
  tasks: Task[]
  onToggleTask: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail: (task: Task) => void
  onNavigateToTasks: () => void
}

export function MinimalistTodayTasks({
  tasks = [],
  onToggleTask,
  onOpenTaskDetail,
  onNavigateToTasks,
}: MinimalistTodayTasksProps) {
  const pendingTasks = tasks.filter((t) => t.status === 'pending')

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'pending' && b.status === 'completed') return -1
    if (a.status === 'completed' && b.status === 'pending') return 1
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })

  if (tasks.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PENDIENTES PRÓXIMOS</Text>
        </View>
        <View style={styles.emptyBox}>
          <CheckCircle2 size={24} color="#27272A" />
          <Text style={styles.emptyText}>¡Todo al día! No tienes entregas urgentes.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          PENDIENTES ({pendingTasks.length})
        </Text>
        <Pressable onPress={onNavigateToTasks} hitSlop={10} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>Ver todas</Text>
          <ChevronRight size={13} color="#818CF8" />
        </Pressable>
      </View>

      {/* Lista Plana (Sin Cajas Envolventes Repetitivas) */}
      <View style={styles.flatList}>
        {sortedTasks.slice(0, 4).map((task, idx) => {
          const isDone = task.status === 'completed'
          return (
            <View
              key={task.id}
              style={[
                styles.taskRow,
                idx < Math.min(tasks.length, 4) - 1 && styles.taskRowBorder,
              ]}
            >
              {/* Checkbox Circular */}
              <Pressable
                onPress={() => {
                  triggerHaptic(isDone ? 'light' : 'success')
                  onToggleTask(task.id, task.status)
                }}
                style={[styles.checkbox, isDone && styles.checkboxDone]}
                hitSlop={8}
              >
                {isDone && <Check size={11} color="#09090B" strokeWidth={3} />}
              </Pressable>

              {/* Título e Info */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onOpenTaskDetail(task)
                }}
                style={styles.taskContent}
              >
                <Text
                  style={[styles.taskTitle, isDone && styles.taskTitleDone]}
                  numberOfLines={1}
                >
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
                    <Text style={styles.typeTag}>â€¢ {task.type}</Text>
                  )}
                </View>
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    color: '#818CF8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  flatList: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  taskRowBorder: {
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
  taskContent: {
    flex: 1,
    gap: 3,
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12,
  },
})
