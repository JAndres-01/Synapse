import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native'
import type { Schedule, Subject, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MapPin, CheckSquare } from 'lucide-react-native'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  subjects: Subject[]
  tasks?: Task[]
}

const DAYS = [
  { num: 1, name: 'Lunes', short: 'LUN' },
  { num: 2, name: 'Martes', short: 'MAR' },
  { num: 3, name: 'Miércoles', short: 'MIÉ' },
  { num: 4, name: 'Jueves', short: 'JUE' },
  { num: 5, name: 'Viernes', short: 'VIE' },
]

function MatrixSlotView({
  blockNum,
  schedule,
  pendingTaskCount = 0,
}: {
  blockNum: number
  schedule?: Schedule | null
  pendingTaskCount?: number
}) {
  const hasSubj = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = subjColor === '#FFFFFF'

  return (
    <View
      style={[
        styles.slotCard,
        hasSubj ? styles.slotCardFilled : styles.slotCardEmpty,
      ]}
    >
      {hasSubj ? (
        <View style={styles.slotFilledContent}>
          {/* Cabecera del bloque */}
          <View style={styles.slotTopSection}>
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

              {/* Indicador de Tareas */}
              {pendingTaskCount > 0 && (
                <View style={styles.taskBadge}>
                  <CheckSquare size={8.5} color="#FFFFFF" />
                  <Text style={styles.taskBadgeText}>{pendingTaskCount}</Text>
                </View>
              )}
            </View>

            <Text style={styles.slotSubjectName} numberOfLines={2}>
              {schedule!.subject!.name}
            </Text>
          </View>

          {/* Aula */}
          {Boolean(schedule?.classroom_room) ? (
            <View style={styles.slotMetaRow}>
              <MapPin size={9.5} color="#71717A" />
              <Text style={styles.slotMetaText} numberOfLines={1}>
                {schedule!.classroom_room}
              </Text>
            </View>
          ) : (
            <View style={styles.slotMetaEmpty} />
          )}
        </View>
      ) : (
        <View style={styles.slotEmptyContent}>
          <Text style={styles.slotEmptyText}>Libre</Text>
        </View>
      )}
    </View>
  )
}

export function MinimalistWeeklyMatrix({
  schedules = [],
  subjects = [],
  tasks = [],
}: MinimalistWeeklyMatrixProps) {
  const currentDay = new Date().getDay()

  const getPendingTasksForDayAndSubject = (day: number, subjectId?: string | null) => {
    if (!subjectId) return 0
    return tasks.filter((t) => {
      if (t.status !== 'pending' || t.subject_id !== subjectId) return false
      if (!t.due_date) return true
      try {
        const taskDate = new Date(t.due_date)
        const dayNum = taskDate.getDay() === 0 ? 7 : taskDate.getDay()
        return dayNum === day
      } catch {
        return true
      }
    }).length
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.matrixGrid}>
          {/* Fila de Encabezados de Días */}
          <View style={styles.headerRow}>
            {DAYS.map((d) => {
              const isToday = currentDay === d.num
              return (
                <View
                  key={d.num}
                  style={[
                    styles.dayHeaderCell,
                    isToday && styles.dayHeaderCellToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayHeaderText,
                      isToday && styles.dayHeaderTextToday,
                    ]}
                  >
                    {d.short}
                  </Text>
                  {isToday && (
                    <View style={styles.todayIndicator}>
                      <Text style={styles.todayIndicatorText}>HOY</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          {/* Cuerpo de la Matriz (4 Bloques por Día) */}
          <View style={styles.bodyRow}>
            {DAYS.map((d) => {
              const daySchedules = schedules.filter((s) => s.day_of_week === d.num)
              const isToday = currentDay === d.num

              return (
                <View
                  key={d.num}
                  style={[
                    styles.dayColumn,
                    isToday && styles.dayColumnToday,
                  ]}
                >
                  <View style={styles.daySlotsColumn}>
                    {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
                      const item = daySchedules.find((s) => s.block_number === blockDef.block)
                      const pendingTaskCount = getPendingTasksForDayAndSubject(d.num, item?.subject_id)

                      return (
                        <View key={blockDef.block} style={styles.slotCardOuter}>
                          <MatrixSlotView
                            blockNum={blockDef.block}
                            schedule={item}
                            pendingTaskCount={pendingTaskCount}
                          />
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  matrixGrid: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayHeaderCell: {
    width: 120,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dayHeaderCellToday: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dayHeaderText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  dayHeaderTextToday: {
    color: '#09090B',
    fontWeight: '800',
  },
  todayIndicator: {
    backgroundColor: '#09090B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  todayIndicatorText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayColumn: {
    width: 120,
  },
  dayColumnToday: {
    borderRadius: 14,
  },
  daySlotsColumn: {
    gap: 8,
  },
  slotCardOuter: {
    height: 90,
  },
  slotCard: {
    flex: 1,
    borderRadius: 13,
    padding: 9,
    justifyContent: 'space-between',
  },
  slotCardFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
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
  slotTopSection: {
    gap: 3.5,
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
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  slotMetaText: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '500',
    maxWidth: 95,
  },
  slotMetaEmpty: {
    height: 8,
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
