import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import type { Schedule, Subject, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { User, MapPin, Clock, CheckSquare } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistDayViewProps {
  schedules: Schedule[]
  subjects: Subject[]
  tasks?: Task[]
  selectedDay: number // 1: Lun ... 5: Vie
  onSelectDay: (day: number) => void
  onOpenDayTasks: (day: number) => void
}

const DAYS = [
  { num: 1, name: 'Lunes', short: 'Lun' },
  { num: 2, name: 'Martes', short: 'Mar' },
  { num: 3, name: 'Miércoles', short: 'Mié' },
  { num: 4, name: 'Jueves', short: 'Jue' },
  { num: 5, name: 'Viernes', short: 'Vie' },
]

function DayClassRow({
  blockDef,
  schedule,
  classTasks = [],
  isLast,
  onPressClass,
}: {
  blockDef: { block: number; startTime: string; endTime: string; label: string }
  schedule?: Schedule | null
  classTasks?: Task[]
  isLast: boolean
  onPressClass: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const isAssigned = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = subjColor === '#FFFFFF'
  const pendingTasks = classTasks.filter((t) => t.status === 'pending')

  const handlePressIn = () => {
    if (!isAssigned) return
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      stiffness: 600,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    if (!isAssigned) return
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 22,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.rowOuter]}>
      <Pressable
        onPress={() => {
          if (isAssigned) {
            triggerHaptic('light')
            onPressClass()
          }
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.rowContainer, !isLast && styles.rowBorder]}
      >
        {/* Columna Izquierda: Hora y Bloque */}
        <View style={styles.timeCol}>
          <Text style={styles.timeStartText}>{blockDef.startTime}</Text>
          <Text style={styles.timeEndText}>{blockDef.endTime}</Text>
          <View style={styles.blockBadge}>
            <Text style={styles.blockBadgeText}>B{blockDef.block}</Text>
          </View>
        </View>

        {/* Columna Derecha: Información de la Materia y Tareas */}
        <View style={styles.contentCol}>
          {isAssigned ? (
            <>
              <View style={styles.subjectHeaderRow}>
                <View style={styles.subjectRow}>
                  <View
                    style={[
                      styles.subjDot,
                      { backgroundColor: subjColor },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.subjectTitle} numberOfLines={1}>
                    {schedule!.subject!.name}
                  </Text>
                </View>

                {/* Badge de Tareas Pendientes */}
                {pendingTasks.length > 0 && (
                  <View style={styles.taskBadge}>
                    <CheckSquare size={10} color="#FFFFFF" />
                    <Text style={styles.taskBadgeText}>{pendingTasks.length}</Text>
                  </View>
                )}
              </View>

              {/* Metadatos: Aula y Docente */}
              <View style={styles.metaRow}>
                {Boolean(schedule?.classroom_room) && (
                  <View style={styles.metaItem}>
                    <MapPin size={11} color="#71717A" />
                    <Text style={styles.metaText}>{schedule!.classroom_room}</Text>
                  </View>
                )}

                {Boolean(schedule?.classroom_room) && Boolean(schedule?.subject?.teacher_name) && (
                  <Text style={styles.metaDot}>•</Text>
                )}

                {Boolean(schedule?.subject?.teacher_name) && (
                  <View style={styles.metaItem}>
                    <User size={11} color="#71717A" />
                    <Text style={styles.metaText}>{schedule!.subject!.teacher_name}</Text>
                  </View>
                )}
              </View>

              {/* Tareas Correspondientes a esta Clase */}
              {classTasks.length > 0 && (
                <View style={styles.classTasksList}>
                  {classTasks.slice(0, 3).map((t) => {
                    const isDone = t.status === 'completed'
                    return (
                      <View key={t.id} style={styles.taskLine}>
                        <View style={[styles.microDot, isDone && styles.microDotDone]} />
                        <Text
                          style={[styles.taskLineTitle, isDone && styles.taskLineTitleDone]}
                          numberOfLines={1}
                        >
                          {t.title}
                        </Text>
                      </View>
                    )
                  })}
                  {classTasks.length > 3 && (
                    <Text style={styles.moreTasksText}>
                      +{classTasks.length - 3} tareas más...
                    </Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.freeSlotWrapper}>
              <Text style={styles.freeTitle}>Hora Libre</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

export function MinimalistDayView({
  schedules = [],
  subjects = [],
  tasks = [],
  selectedDay,
  onSelectDay,
  onOpenDayTasks,
}: MinimalistDayViewProps) {
  const currentDay = new Date().getDay()
  const daySchedules = schedules.filter((s) => s.day_of_week === selectedDay)

  return (
    <View style={styles.container}>
      {/* Selector de Días Horizontal con Glassmorfismo Nativo */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 55 : 90}
        tint={Platform.OS === 'ios' ? 'systemThinMaterialDark' : 'dark'}
        style={styles.daySelectorContainer}
      >
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.num
          const isToday = currentDay === d.num

          return (
            <Pressable
              key={d.num}
              onPress={() => {
                triggerHaptic('selection')
                onSelectDay(d.num)
              }}
              style={[
                styles.dayPill,
                isSelected && styles.dayPillActive,
                isToday && !isSelected && styles.dayPillToday,
              ]}
            >
              <Text
                style={[
                  styles.dayPillText,
                  isSelected && styles.dayPillTextActive,
                  isToday && !isSelected && styles.dayPillTextToday,
                ]}
              >
                {d.short}
              </Text>
              {isToday && (
                <View
                  style={[
                    styles.todayDot,
                    isSelected && styles.todayDotActive,
                  ]}
                />
              )}
            </Pressable>
          )
        })}
      </BlurView>

      {/* Lista Abierta y Continua de 4 Bloques Diarios */}
      <View style={styles.blocksList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, idx) => {
          const item = daySchedules.find((s) => s.block_number === blockDef.block)

          // Filtrar las tareas correspondientes a la materia de este bloque
          const classTasks = tasks.filter((t) => {
            if (!item?.subject_id) return false
            if (t.subject_id !== item.subject_id) return false
            if (t.due_date) {
              try {
                const taskDate = new Date(t.due_date)
                const dayNum = taskDate.getDay() === 0 ? 7 : taskDate.getDay()
                if (dayNum === selectedDay) return true
              } catch {}
            }
            return t.status === 'pending'
          })

          return (
            <DayClassRow
              key={blockDef.block}
              blockDef={blockDef}
              schedule={item}
              classTasks={classTasks}
              isLast={idx === PERSONAL_SCHEDULE_BLOCKS.length - 1}
              onPressClass={() => onOpenDayTasks(selectedDay)}
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  daySelectorContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 4,
    overflow: 'hidden',
  },
  dayPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    gap: 4,
  },
  dayPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  dayPillToday: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
  },
  dayPillTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  dayPillTextToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  todayDotActive: {
    backgroundColor: '#09090B',
  },
  blocksList: {
    paddingHorizontal: 2,
  },
  rowOuter: {
    width: '100%',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  timeCol: {
    width: 54,
    alignItems: 'flex-start',
    gap: 2,
    paddingTop: 1,
  },
  timeStartText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  timeEndText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
  },
  blockBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginTop: 2,
  },
  blockBadgeText: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
  },
  contentCol: {
    flex: 1,
    gap: 4,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  subjDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 11,
  },
  classTasksList: {
    marginTop: 6,
    gap: 4,
  },
  taskLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  microDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A1A1AA',
  },
  microDotDone: {
    backgroundColor: '#3F3F46',
  },
  taskLineTitle: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  taskLineTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  moreTasksText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  freeSlotWrapper: {
    gap: 2,
  },
  freeTitle: {
    color: '#52525B',
    fontSize: 14.5,
    fontWeight: '600',
  },
})
