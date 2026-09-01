import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
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

function DayClassCard({
  blockDef,
  schedule,
  onPress,
}: {
  blockDef: { block: number; startTime: string; endTime: string; label: string }
  schedule?: Schedule | null
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const isAssigned = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = subjColor === '#FFFFFF'

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      stiffness: 550,
      damping: 26,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onPress()
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.classCard,
          isAssigned
            ? [
                styles.classCardAssigned,
                {
                  backgroundColor: isWhite
                    ? 'rgba(255, 255, 255, 0.05)'
                    : `${subjColor}12`,
                  borderColor: isWhite
                    ? 'rgba(255, 255, 255, 0.16)'
                    : `${subjColor}38`,
                },
              ]
            : styles.classCardFree,
        ]}
      >
        {/* Barra de Color Lateral */}
        <View
          style={[
            styles.cardColorBar,
            {
              backgroundColor: isAssigned ? subjColor : 'rgba(255, 255, 255, 0.1)',
            },
            isAssigned && isWhite && styles.whiteBarBorder,
          ]}
        />

        <View style={styles.cardMainContent}>
          {/* Fila Superior: Bloque y Horario */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.blockBadge}>
              <Text style={styles.blockBadgeText}>Bloque {blockDef.block}</Text>
            </View>

            <View style={styles.timeTag}>
              <Clock size={11} color="#818CF8" />
              <Text style={styles.timeTagText}>
                {blockDef.startTime} - {blockDef.endTime}
              </Text>
            </View>
          </View>

          {/* Nombre de la Materia */}
          <Text
            style={[
              styles.cardSubjectTitle,
              !isAssigned && styles.cardSubjectTitleFree,
            ]}
            numberOfLines={1}
          >
            {isAssigned ? schedule!.subject!.name : 'Hora Libre'}
          </Text>

          {/* Fila de Metadatos: Profesor y Aula */}
          {isAssigned ? (
            <View style={styles.cardMetaRow}>
              {Boolean(schedule?.classroom_room) && (
                <View style={styles.metaItem}>
                  <MapPin size={12} color="#A1A1AA" />
                  <Text style={styles.metaText}>{schedule!.classroom_room}</Text>
                </View>
              )}

              {Boolean(schedule?.classroom_room) && Boolean(schedule?.subject?.teacher_name) && (
                <Text style={styles.metaDot}>•</Text>
              )}

              {Boolean(schedule?.subject?.teacher_name) && (
                <View style={styles.metaItem}>
                  <User size={12} color="#A1A1AA" />
                  <Text style={styles.metaText}>{schedule!.subject!.teacher_name}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.cardMetaRow}>
              <View style={styles.freePromptRow}>
                <Plus size={12} color="#71717A" />
                <Text style={styles.freePromptText}>Toca para asignar materia a este bloque</Text>
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
      {/* Selector de Días Horizontal */}
      <View style={styles.daySelectorContainer}>
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
      </View>

      {/* Lista de 4 Bloques Diarios */}
      <View style={styles.blocksList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
          const item = daySchedules.find((s) => s.block_number === blockDef.block)
          return (
            <DayClassCard
              key={blockDef.block}
              blockDef={blockDef}
              schedule={item}
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
    gap: 14,
  },
  daySelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  dayPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    gap: 4,
  },
  dayPillActive: {
    backgroundColor: '#FFFFFF',
  },
  dayPillToday: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
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
    color: '#818CF8',
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#818CF8',
  },
  todayDotActive: {
    backgroundColor: '#09090B',
  },
  blocksList: {
    gap: 10,
  },
  classCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 88,
  },
  classCardAssigned: {},
  classCardFree: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderStyle: 'dashed',
  },
  cardColorBar: {
    width: 4.5,
  },
  whiteBarBorder: {
    borderRightWidth: 1,
    borderRightColor: '#71717A',
  },
  cardMainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    justifyContent: 'center',
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  blockBadgeText: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeTagText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cardSubjectTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardSubjectTitleFree: {
    color: '#71717A',
    fontWeight: '600',
    fontSize: 15.5,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  metaText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 12,
  },
  freePromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freePromptText: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '500',
  },
})
