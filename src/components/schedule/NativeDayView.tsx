import React from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import type { Schedule, Subject } from '@/types/database'
import { SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, Video, User, Plus, Edit2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'

interface NativeDayViewProps {
  schedules: Schedule[]
  subjects: Subject[]
  selectedDay: number
  onSelectDay: (day: number) => void
  isAdmin?: boolean
  onAssignSlot?: (day: number, block: number, existingSchedule?: Schedule) => void
}

const DAYS = [
  { num: 1, name: 'Lunes', short: 'LUN' },
  { num: 2, name: 'Martes', short: 'MAR' },
  { num: 3, name: 'Miércoles', short: 'MIÉ' },
  { num: 4, name: 'Jueves', short: 'JUE' },
  { num: 5, name: 'Viernes', short: 'VIE' },
]

export function NativeDayView({
  schedules,
  subjects,
  selectedDay,
  onSelectDay,
  isAdmin,
  onAssignSlot,
}: NativeDayViewProps) {
  const daySchedules = schedules.filter((s) => s.day_of_week === selectedDay)

  return (
    <View style={styles.container}>
      {/* Selector de Días (Lunes a Viernes) */}
      <View style={styles.daysRow}>
        {DAYS.map((d) => {
          const isSelected = d.num === selectedDay
          return (
            <Pressable
              key={d.num}
              onPress={() => {
                triggerHaptic('light')
                onSelectDay(d.num)
              }}
              style={[
                styles.dayPill,
                isSelected && styles.dayPillSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayPillText,
                  isSelected && styles.dayPillTextSelected,
                ]}
              >
                {d.short}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Lista de las 4 clases */}
      <View style={styles.blocksList}>
        {SCHEDULE_BLOCKS.map((blockDef) => {
          const scheduled = daySchedules.find((s) => s.block_number === blockDef.block)

          return (
            <View
              key={blockDef.block}
              style={[
                styles.blockCard,
                !scheduled && styles.blockCardEmpty,
              ]}
            >
              <View style={styles.blockHeader}>
                <View style={styles.blockTimeRow}>
                  <View style={styles.badgeBlock}>
                    <Text style={styles.badgeBlockText}>Clase {blockDef.block}</Text>
                  </View>
                  <Text style={styles.blockTimeText}>
                    {blockDef.startTime} - {blockDef.endTime}
                  </Text>
                </View>

                {scheduled?.is_virtual ? (
                  <View style={styles.virtualBadge}>
                    <Video size={10} color="#818CF8" />
                    <Text style={styles.virtualBadgeText}>Virtual</Text>
                  </View>
                ) : isAdmin ? (
                  <Pressable
                    onPress={() => {
                      triggerHaptic('light')
                      onAssignSlot?.(selectedDay, blockDef.block, scheduled)
                    }}
                    hitSlop={8}
                    style={styles.adminEditBtn}
                  >
                    {scheduled ? (
                      <Edit2 size={11} color="#A1A1AA" />
                    ) : (
                      <Plus size={12} color="#818CF8" />
                    )}
                  </Pressable>
                ) : null}
              </View>

              {scheduled ? (
                <View style={styles.scheduledBody}>
                  <View style={styles.subjectRow}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: scheduled.subject?.color || '#6366F1' },
                      ]}
                    />
                    <Text style={styles.subjectName} numberOfLines={1}>
                      {scheduled.subject?.name || 'Materia'}
                    </Text>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <MapPin size={11} color="#71717A" />
                      <Text style={styles.detailText}>
                        {scheduled.classroom_room || 'Aula Principal'}
                      </Text>
                    </View>
                    {scheduled.subject?.teacher_name && (
                      <View style={styles.detailItem}>
                        <User size={11} color="#71717A" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {scheduled.subject.teacher_name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.emptySlot}>
                  <Text style={styles.emptySlotText}>Bloque libre</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dayPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 11,
  },
  dayPillSelected: {
    backgroundColor: '#FFFFFF',
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dayPillTextSelected: {
    color: '#09090B',
  },
  blocksList: {
    gap: 8,
  },
  blockCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    gap: 8,
  },
  blockCardEmpty: {
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeBlock: {
    backgroundColor: '#27272A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeBlockText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  blockTimeText: {
    color: '#71717A',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  virtualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(49, 46, 129, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  virtualBadgeText: {
    color: '#A5B4FC',
    fontSize: 9.5,
    fontWeight: '600',
  },
  adminEditBtn: {
    padding: 4,
  },
  scheduledBody: {
    gap: 4,
    paddingLeft: 2,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#71717A',
    fontSize: 11,
  },
  emptySlot: {
    paddingLeft: 2,
  },
  emptySlotText: {
    color: '#52525B',
    fontSize: 11,
    fontStyle: 'italic',
  },
})
