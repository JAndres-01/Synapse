import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import type { Schedule, Subject } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { User, MapPin, Plus, Clock } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistDayViewProps {
  schedules: Schedule[]
  subjects: Subject[]
  selectedDay: number // 1: Lun ... 5: Vie
  onSelectDay: (day: number) => void
  onAssignSlot: (day: number, block: number, existing?: Schedule) => void
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
  isLast,
  onPress,
}: {
  blockDef: { block: number; startTime: string; endTime: string; label: string }
  schedule?: Schedule | null
  isLast: boolean
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const isAssigned = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = subjColor === '#FFFFFF'

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
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

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.rowOuter]}>
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onPress()
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

        {/* Columna Derecha: Información de la Materia */}
        <View style={styles.contentCol}>
          {isAssigned ? (
            <>
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

              <View style={styles.metaRow}>
                {Boolean(schedule?.classroom_room) && (
                  <View style={styles.metaItem}>
                    <MapPin size={11.5} color="#71717A" />
                    <Text style={styles.metaText}>{schedule!.classroom_room}</Text>
                  </View>
                )}

                {Boolean(schedule?.classroom_room) && Boolean(schedule?.subject?.teacher_name) && (
                  <Text style={styles.metaDot}>•</Text>
                )}

                {Boolean(schedule?.subject?.teacher_name) && (
                  <View style={styles.metaItem}>
                    <User size={11.5} color="#71717A" />
                    <Text style={styles.metaText}>{schedule!.subject!.teacher_name}</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.freeSlotWrapper}>
              <Text style={styles.freeTitle}>Hora Libre</Text>
              <View style={styles.freePromptRow}>
                <Plus size={11} color="#52525B" />
                <Text style={styles.freePromptText}>Toca para asignar materia</Text>
              </View>
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
  selectedDay,
  onSelectDay,
  onAssignSlot,
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

      {/* Lista Abierta y Continua de 4 Bloques Diarios (Sin Cards Pesadas) */}
      <View style={styles.blocksList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, idx) => {
          const item = daySchedules.find((s) => s.block_number === blockDef.block)
          return (
            <DayClassRow
              key={blockDef.block}
              blockDef={blockDef}
              schedule={item}
              isLast={idx === PERSONAL_SCHEDULE_BLOCKS.length - 1}
              onPress={() => onAssignSlot(selectedDay, blockDef.block, item)}
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
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  timeCol: {
    width: 58,
    alignItems: 'flex-start',
    gap: 2,
  },
  timeStartText: {
    color: '#FFFFFF',
    fontSize: 13,
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
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7.5,
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
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
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
    fontSize: 11.5,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 11,
  },
  freeSlotWrapper: {
    gap: 2,
  },
  freeTitle: {
    color: '#52525B',
    fontSize: 14.5,
    fontWeight: '600',
  },
  freePromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freePromptText: {
    color: '#3F3F46',
    fontSize: 11,
    fontWeight: '500',
  },
})
