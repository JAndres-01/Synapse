import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Schedule, Subject } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS, BREAK_BLOCK } from '@/lib/scheduleEngine'
import { MapPin, Plus, User } from 'lucide-react-native'
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
  { num: 3, name: 'MiÃ©' },
  { num: 4, name: 'Jue' },
  { num: 5, name: 'Vie' },
]

export function MinimalistDayView({
  schedules = [],
  selectedDay,
  onSelectDay,
  onAssignSlot,
}: MinimalistDayViewProps) {
  const daySchedules = schedules.filter((s) => s.day_of_week === selectedDay)

  return (
    <View style={styles.container}>
      {/* Selector de DÃ­as Minimalista */}
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

      {/* Lista de 4 Bloques Diarios */}
      <View style={styles.blocksList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, index) => {
          const item = daySchedules.find((s) => s.block_number === blockDef.block)

          return (
            <React.Fragment key={blockDef.block}>
              {/* Bloque de Clase */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onAssignSlot(selectedDay, blockDef.block, item)
                }}
                style={styles.blockCard}
              >
                {/* Indicador de Color Lateral */}
                <View
                  style={[
                    styles.colorBar,
                    { backgroundColor: item?.subject?.color || '#27272A' },
                  ]}
                />

                <View style={styles.blockContent}>
                  <View style={styles.blockHeader}>
                    <Text style={styles.blockName}>
                      {item?.subject?.name || 'Bloque Libre'}
                    </Text>
                    <View style={styles.timeTag}>
                      <Text style={styles.timeText}>
                        {blockDef.startTime} - {blockDef.endTime}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.blockMeta}>
                    {item?.classroom_room && (
                      <View style={styles.metaItem}>
                        <MapPin size={11} color="#818CF8" />
                        <Text style={styles.roomText}>{item.classroom_room}</Text>
                      </View>
                    )}

                    {item?.subject?.teacher_name && (
                      <View style={styles.metaItem}>
                        <User size={11} color="#71717A" />
                        <Text style={styles.teacherText}>{item.subject.teacher_name}</Text>
                      </View>
                    )}

                    {!item?.subject && (
                      <Text style={styles.tapToAssignText}>Toca para asignar materia</Text>
                    )}
                  </View>
                </View>
              </Pressable>

              {/* Receso entre bloque 2 y 3 */}
              {blockDef.block === 2 && (
                <View style={styles.breakBanner}>
                  <View style={styles.breakDot} />
                  <Text style={styles.breakText}>
                    RECESO â€¢ {BREAK_BLOCK.startTime} - {BREAK_BLOCK.endTime} (30 MIN)
                  </Text>
                </View>
              )}
            </React.Fragment>
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
    gap: 3,
  },
  roomText: {
    color: '#818CF8',
    fontSize: 11.5,
    fontWeight: '500',
  },
  teacherText: {
    color: '#71717A',
    fontSize: 11,
  },
  tapToAssignText: {
    color: '#52525B',
    fontSize: 11,
    fontStyle: 'italic',
  },
  breakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  breakDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  breakText: {
    color: '#A1A1AA',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
