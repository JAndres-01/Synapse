import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Schedule, Subject } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { User, Sparkles } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistDayViewProps {
  schedules: Schedule[]
  subjects: Subject[]
  selectedDay: number // 1: Lun ... 5: Vie
  onSelectDay: (day: number) => void
  onAssignSlot: (day: number, block: number, existing?: Schedule) => void
}

const DAYS = [
  { num: 1, name: 'Lun' },
  { num: 2, name: 'Mar' },
  { num: 3, name: 'Mié' },
  { num: 4, name: 'Jue' },
  { num: 5, name: 'Vie' },
]

export function MinimalistDayView({
  schedules = [],
  subjects = [],
  selectedDay,
  onSelectDay,
  onAssignSlot,
}: MinimalistDayViewProps) {
  const daySchedules = schedules.filter((s) => s.day_of_week === selectedDay)

  return (
    <View style={styles.container}>
      {/* Selector de Días Minimalista */}
      <View style={styles.daysRow}>
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.num
          return (
            <Pressable
              key={d.num}
              onPress={() => {
                triggerHaptic('light')
                onSelectDay(d.num)
              }}
              style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
            >
              <Text style={[styles.dayBtnText, isSelected && styles.dayBtnTextActive]}>
                {d.name}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Lista de 4 Bloques Diarios Continuos (Sin Receso) */}
      <View style={styles.blocksList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
          const item = daySchedules.find((s) => s.block_number === blockDef.block)
          const isAssigned = Boolean(item?.subject)
          const isWhite = item?.subject?.color === '#FFFFFF'

          return (
            <Pressable
              key={blockDef.block}
              onPress={() => {
                triggerHaptic('light')
                onAssignSlot(selectedDay, blockDef.block, item)
              }}
              style={[
                styles.blockCard,
                !isAssigned && styles.blockCardFree,
              ]}
            >
              {/* Indicador de Color Lateral */}
              <View
                style={[
                  styles.colorBar,
                  {
                    backgroundColor: isAssigned
                      ? item?.subject?.color || '#FFFFFF'
                      : 'transparent',
                  },
                ]}
              />

              <View style={styles.blockContent}>
                <View style={styles.blockHeader}>
                  <Text
                    style={[
                      styles.blockName,
                      !isAssigned && styles.blockNameFree,
                    ]}
                  >
                    {isAssigned ? item?.subject?.name : 'Hora Libre'}
                  </Text>
                  <View style={styles.timeTag}>
                    <Text style={styles.timeText}>
                      {blockDef.startTime} - {blockDef.endTime}
                    </Text>
                  </View>
                </View>

                <View style={styles.blockMeta}>
                  {isAssigned && item?.subject?.teacher_name ? (
                    <View style={styles.metaItem}>
                      <User size={11} color="#71717A" />
                      <Text style={styles.teacherText}>{item.subject.teacher_name}</Text>
                    </View>
                  ) : null}

                  {!isAssigned && (
                    <View style={styles.metaItem}>
                      <Sparkles size={11} color="#52525B" />
                      <Text style={styles.tapToAssignText}>
                        Libre / Toca para asignar materia
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
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
  daysRow: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  dayBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  dayBtnText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
  dayBtnTextActive: {
    color: '#09090B',
  },
  blocksList: {
    gap: 8,
  },
  blockCard: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  blockCardFree: {
    borderStyle: 'dashed',
    borderColor: '#3F3F46',
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
  },
  colorBar: {
    width: 4,
  },
  blockContent: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  blockNameFree: {
    color: '#A1A1AA',
    fontStyle: 'normal',
  },
  timeTag: {
    backgroundColor: '#09090B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teacherText: {
    color: '#71717A',
    fontSize: 11,
  },
  tapToAssignText: {
    color: '#52525B',
    fontSize: 11,
  },
})
