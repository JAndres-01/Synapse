import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Schedule, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MapPin, User, Check, CheckSquare } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistDayTimelineProps {
  schedulesToday: Schedule[]
  tasks?: Task[]
  onToggleTask?: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail?: (task: Task) => void
}

export function MinimalistDayTimeline({
  schedulesToday = [],
  tasks = [],
  onToggleTask,
  onOpenTaskDetail,
}: MinimalistDayTimelineProps) {
  const now = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const todayDayOfWeek = now.getDay() === 0 ? 7 : now.getDay()

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CRONOGRAMA DE HOY (4 BLOQUES)</Text>

      <View style={styles.timelineList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, index) => {
          const [startH, startM] = blockDef.startTime.split(':').map(Number)
          const [endH, endM] = blockDef.endTime.split(':').map(Number)
          const startTotal = startH * 60 + startM
          const endTotal = endH * 60 + endM

          const isCurrent = currentMins >= startTotal && currentMins < endTotal
          const isPast = currentMins >= endTotal

          const sched = schedulesToday.find((s) => s.block_number === blockDef.block)
          const subjColor = sched?.subject?.color || '#FFFFFF'
          const isWhite = subjColor === '#FFFFFF'

          // Filtrar tareas que pertenecen a la materia de esta clase y cuya entrega es hoy
          const classTasks = tasks.filter((t) => {
            if (!t.due_date || !sched?.subject_id) return false
            if (t.subject_id !== sched.subject_id) return false
            try {
              const taskDate = new Date(t.due_date)
              return (
                taskDate.getFullYear() === now.getFullYear() &&
                taskDate.getMonth() === now.getMonth() &&
                taskDate.getDate() === now.getDate()
              )
            } catch {
              return false
            }
          })

          const pendingTasksInClass = classTasks.filter((t) => t.status === 'pending').length

          return (
            <View
              key={blockDef.block}
              style={[
                styles.blockRow,
                isPast && styles.blockRowPast,
              ]}
            >
              {/* Columna de Hora */}
              <View style={styles.timeCol}>
                <Text
                  style={[
                    styles.timeText,
                    isCurrent && styles.timeTextCurrent,
                    isPast && styles.timeTextPast,
                  ]}
                >
                  {blockDef.startTime}
                </Text>
                <Text style={styles.blockNumText}>C{blockDef.block}</Text>
              </View>

              {/* Indicador de Línea Vertical */}
              <View style={styles.lineCol}>
                <View
                  style={[
                    styles.lineDot,
                    isCurrent && styles.lineDotCurrent,
                    isPast && styles.lineDotPast,
                    Boolean(sched?.subject) && { backgroundColor: subjColor },
                    isWhite && styles.whiteDotBorder,
                  ]}
                />
                {index < PERSONAL_SCHEDULE_BLOCKS.length - 1 && (
                  <View
                    style={[
                      styles.verticalLine,
                      isPast && styles.verticalLinePast,
                    ]}
                  />
                )}
              </View>

              {/* Información de la Clase */}
              <View
                style={[
                  styles.contentCol,
                  isCurrent && styles.contentColCurrent,
                ]}
              >
                {sched?.subject ? (
                  <>
                    <View style={styles.subjectHeaderRow}>
                      <Text
                        style={[
                          styles.subjectTitle,
                          isPast && styles.subjectTitlePast,
                        ]}
                        numberOfLines={1}
                      >
                        {sched.subject.name}
                      </Text>
                      <View style={styles.badgesRightRow}>
                        {pendingTasksInClass > 0 && (
                          <View style={styles.taskBadge}>
                            <CheckSquare size={9} color="#FFFFFF" />
                            <Text style={styles.taskBadgeText}>{pendingTasksInClass}</Text>
                          </View>
                        )}
                        {isCurrent && (
                          <View style={styles.nowBadge}>
                            <Text style={styles.nowBadgeText}>En curso</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {(Boolean(sched.classroom_room) || Boolean(sched.subject.teacher_name)) && (
                      <View style={styles.metaRow}>
                        {Boolean(sched.classroom_room) && (
                          <View style={styles.metaItem}>
                            <MapPin size={11} color="#71717A" />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {sched.classroom_room}
                            </Text>
                          </View>
                        )}

                        {Boolean(sched.subject.teacher_name) && (
                          <View style={styles.metaItem}>
                            <User size={11} color="#71717A" />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {sched.subject.teacher_name}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Lista de Tareas a Entregar en esta Clase */}
                    {classTasks.length > 0 && (
                      <View style={styles.classTasksBox}>
                        <View style={styles.classTasksHeaderRow}>
                          <Text style={styles.classTasksLabel}>ENTREGAS DE ESTA CLASE</Text>
                        </View>

                        <View style={styles.classTasksList}>
                          {classTasks.map((t) => {
                            const isDone = t.status === 'completed'
                            return (
                              <Pressable
                                key={t.id}
                                onPress={() => {
                                  triggerHaptic('light')
                                  onOpenTaskDetail?.(t)
                                }}
                                style={[styles.classTaskRow, isDone && styles.classTaskRowDone]}
                              >
                                <Pressable
                                  onPress={() => {
                                    triggerHaptic(isDone ? 'light' : 'success')
                                    onToggleTask?.(t.id, t.status)
                                  }}
                                  hitSlop={8}
                                  style={[styles.miniCheckbox, isDone && styles.miniCheckboxDone]}
                                >
                                  {isDone && <Check size={9} color="#09090B" strokeWidth={3.5} />}
                                </Pressable>

                                <Text
                                  style={[
                                    styles.classTaskTitle,
                                    isDone && styles.classTaskTitleDone,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t.title}
                                </Text>
                              </Pressable>
                            )
                          })}
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.freeText}>Libre</Text>
                )}
              </View>
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
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  timelineList: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 16,
    gap: 16,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  blockRowPast: {
    opacity: 0.45,
  },
  timeCol: {
    width: 46,
    alignItems: 'flex-start',
    paddingTop: 1,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeTextCurrent: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  timeTextPast: {
    color: '#71717A',
  },
  blockNumText: {
    color: '#52525B',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
  },
  lineCol: {
    width: 22,
    alignItems: 'center',
    paddingTop: 5,
    position: 'relative',
  },
  lineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3F3F46',
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  lineDotCurrent: {
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.25 }],
  },
  lineDotPast: {
    backgroundColor: '#27272A',
  },
  verticalLine: {
    position: 'absolute',
    top: 15,
    bottom: -20,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  verticalLinePast: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  contentCol: {
    flex: 1,
    paddingLeft: 8,
    gap: 4,
    paddingTop: 1,
  },
  contentColCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 8,
    marginLeft: -2,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  subjectTitlePast: {
    color: '#A1A1AA',
  },
  badgesRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    gap: 3,
  },
  taskBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  nowBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  nowBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  metaText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '500',
    maxWidth: 130,
  },
  freeText: {
    color: '#3F3F46',
    fontSize: 12.5,
    fontWeight: '600',
  },
  classTasksBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    marginTop: 4,
    gap: 6,
  },
  classTasksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classTasksLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  classTasksList: {
    gap: 5,
  },
  classTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  classTaskRowDone: {
    opacity: 0.6,
  },
  miniCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCheckboxDone: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  classTaskTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  classTaskTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
})
