import React, { useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native'
import type { Schedule, Subject, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { Clock, MapPin, User, CheckSquare } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  subjects: Subject[]
  tasks?: Task[]
  onDayPress: (day: number) => void
}

const DAYS = [
  { num: 1, name: 'Lunes', short: 'LUN' },
  { num: 2, name: 'Martes', short: 'MAR' },
  { num: 3, name: 'Miércoles', short: 'MIÉ' },
  { num: 4, name: 'Jueves', short: 'JUE' },
  { num: 5, name: 'Viernes', short: 'VIE' },
]

function MatrixSlotCard({
  dayNum,
  blockNum,
  schedule,
  pendingTaskCount = 0,
  onPress,
}: {
  dayNum: number
  blockNum: number
  schedule?: Schedule | null
  pendingTaskCount?: number
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const hasSubj = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = subjColor === '#FFFFFF'

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      stiffness: 500,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 450,
      damping: 22,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.slotCardOuter]}>
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onPress()
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.slotCard,
          hasSubj ? styles.slotCardFilled : styles.slotCardEmpty,
        ]}
      >
        {hasSubj ? (
          <View style={styles.slotFilledContent}>
            {/* Cabecera de la celda: Punto de color + Indicador sutil de tareas + Bloque */}
            <View style={styles.slotHeaderRow}>
              <View style={styles.slotHeaderLeft}>
                <View
                  style={[
                    styles.subjDot,
                    { backgroundColor: subjColor },
                    isWhite && styles.whiteDotBorder,
                  ]}
                />
                <Text style={styles.slotBlockBadge}>C{blockNum}</Text>
              </View>

              {/* Indicador Minimalista de Tareas Pendientes para este día y materia */}
              {pendingTaskCount > 0 && (
                <View style={styles.taskBadge}>
                  <CheckSquare size={8.5} color="#FFFFFF" />
                  <Text style={styles.taskBadgeText}>{pendingTaskCount}</Text>
                </View>
              )}
            </View>

            {/* Nombre de la Materia */}
            <Text style={styles.slotSubjectName} numberOfLines={2}>
              {schedule!.subject!.name}
            </Text>

            {/* Aula o Profesor */}
            {(Boolean(schedule?.classroom_room) || Boolean(schedule?.subject?.teacher_name)) && (
              <View style={styles.slotMetaRow}>
                {Boolean(schedule?.classroom_room) && (
                  <View style={styles.slotMetaItem}>
                    <MapPin size={8.5} color="#71717A" />
                    <Text style={styles.slotMetaText} numberOfLines={1}>
                      {schedule!.classroom_room}
                    </Text>
                  </View>
                )}
                {Boolean(schedule?.subject?.teacher_name) && !schedule?.classroom_room && (
                  <View style={styles.slotMetaItem}>
                    <User size={8.5} color="#71717A" />
                    <Text style={styles.slotMetaText} numberOfLines={1}>
                      {schedule!.subject!.teacher_name}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.slotEmptyContent}>
            <Text style={styles.slotEmptyText}>Libre</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

export function MinimalistWeeklyMatrix({
  schedules = [],
  subjects = [],
  tasks = [],
  onDayPress,
}: MinimalistWeeklyMatrixProps) {
  const currentDay = new Date().getDay()

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Columna Lateral Fija de Horarios */}
        <View style={styles.timeColumn}>
          <View style={styles.timeColHeader}>
            <Clock size={11} color="#71717A" />
            <Text style={styles.timeColHeaderText}>HORA</Text>
          </View>

          {/* 4 Bloques de Horas Neutros */}
          {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => (
            <View key={blockDef.block} style={styles.timeBlockCell}>
              <Text style={styles.timeBlockNum}>C{blockDef.block}</Text>
              <Text style={styles.timeBlockStart}>{blockDef.startTime}</Text>
              <Text style={styles.timeBlockEnd}>{blockDef.endTime}</Text>
            </View>
          ))}
        </View>

        {/* Columnas de los 5 Días de la Semana */}
        <View style={styles.daysGrid}>
          {DAYS.map((d) => {
            const isToday = currentDay === d.num
            return (
              <View key={d.num} style={styles.dayColumn}>
                {/* Cabecera del Día */}
                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    onDayPress(d.num)
                  }}
                  style={[styles.dayHeaderCell, isToday && styles.dayHeaderCellToday]}
                >
                  <Text style={[styles.dayHeaderText, isToday && styles.dayHeaderTextToday]}>
                    {d.short}
                  </Text>
                  {isToday && (
                    <View style={styles.todayIndicatorPill}>
                      <Text style={styles.todayIndicatorText}>Hoy</Text>
                    </View>
                  )}
                </Pressable>

                {/* 4 Celdas correspondientes a los 4 bloques */}
                <View style={styles.daySlotsColumn}>
                  {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
                    const item = schedules.find(
                      (s) => s.day_of_week === d.num && s.block_number === blockDef.block
                    )

                    // Filtrado estricto: contar tareas pendientes cuya fecha de entrega caiga exactamente en este día de la semana
                    const pendingCount = tasks.filter((t) => {
                      if (t.status !== 'pending' || !t.due_date) return false
                      try {
                        const taskDate = new Date(t.due_date)
                        if (isNaN(taskDate.getTime()) || taskDate.getDay() !== d.num) return false
                        if (item?.subject_id) {
                          return t.subject_id === item.subject_id
                        }
                        return true
                      } catch {
                        return false
                      }
                    }).length

                    return (
                      <MatrixSlotCard
                        key={blockDef.block}
                        dayNum={d.num}
                        blockNum={blockDef.block}
                        schedule={item}
                        pendingTaskCount={pendingCount}
                        onPress={() => onDayPress(d.num)}
                      />
                    )
                  })}
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#101014',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
  },
  scrollContent: {
    flexDirection: 'row',
    padding: 10,
  },
  timeColumn: {
    width: 58,
    marginRight: 8,
  },
  timeColHeader: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 9,
    marginBottom: 8,
  },
  timeColHeaderText: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeBlockCell: {
    height: 92,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  timeBlockNum: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  timeBlockStart: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeBlockEnd: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  dayColumn: {
    width: 126,
  },
  dayHeaderCell: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
    gap: 5,
  },
  dayHeaderCellToday: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dayHeaderText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayHeaderTextToday: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  todayIndicatorPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  todayIndicatorText: {
    color: '#09090B',
    fontSize: 8.5,
    fontWeight: '800',
  },
  daySlotsColumn: {
    gap: 8,
  },
  slotCardOuter: {
    height: 92,
  },
  slotCard: {
    flex: 1,
    borderRadius: 13,
    padding: 9,
    justifyContent: 'space-between',
  },
  slotCardFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  slotCardEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilledContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  subjDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  slotBlockBadge: {
    color: '#52525B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 5,
    gap: 2.5,
  },
  taskBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  slotSubjectName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: -0.2,
    marginVertical: 2,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  slotMetaText: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '500',
    maxWidth: 95,
  },
  slotEmptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmptyText: {
    color: '#3F3F46',
    fontSize: 10,
    fontWeight: '600',
  },
})
