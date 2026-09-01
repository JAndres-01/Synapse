import React, { useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native'
import type { Schedule, Subject } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { Plus, Clock, MapPin, User } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  subjects: Subject[]
  onSlotPress: (day: number, block: number, existing?: Schedule) => void
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
  onPress,
}: {
  dayNum: number
  blockNum: number
  schedule?: Schedule | null
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
          hasSubj
            ? [
                styles.slotCardFilled,
                {
                  backgroundColor: isWhite
                    ? 'rgba(255, 255, 255, 0.08)'
                    : `${subjColor}1C`,
                  borderColor: isWhite
                    ? 'rgba(255, 255, 255, 0.22)'
                    : `${subjColor}45`,
                },
              ]
            : styles.slotCardEmpty,
        ]}
      >
        {hasSubj ? (
          <View style={styles.slotFilledContent}>
            <View style={styles.slotHeaderRow}>
              <View
                style={[
                  styles.subjDot,
                  { backgroundColor: subjColor },
                  isWhite && styles.whiteDotBorder,
                ]}
              />
              <Text style={styles.slotBlockBadge}>C{blockNum}</Text>
            </View>

            <Text style={styles.slotSubjectName} numberOfLines={2}>
              {schedule!.subject!.name}
            </Text>

            {(Boolean(schedule?.classroom_room) || Boolean(schedule?.subject?.teacher_name)) && (
              <View style={styles.slotMetaRow}>
                {Boolean(schedule?.classroom_room) && (
                  <View style={styles.slotMetaItem}>
                    <MapPin size={9.5} color="#A1A1AA" />
                    <Text style={styles.slotMetaText} numberOfLines={1}>
                      {schedule!.classroom_room}
                    </Text>
                  </View>
                )}
                {Boolean(schedule?.subject?.teacher_name) && !schedule?.classroom_room && (
                  <View style={styles.slotMetaItem}>
                    <User size={9.5} color="#A1A1AA" />
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
            <Plus size={14} color="#52525B" />
            <Text style={styles.slotEmptyText}>Asignar</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

export function MinimalistWeeklyMatrix({
  schedules = [],
  subjects = [],
  onSlotPress,
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
          {/* Espaciador alineado con la cabecera de días */}
          <View style={styles.timeColHeader}>
            <Clock size={12} color="#71717A" />
            <Text style={styles.timeColHeaderText}>HORA</Text>
          </View>

          {/* 4 Bloques de Horas */}
          {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => (
            <View key={blockDef.block} style={styles.timeBlockCell}>
              <Text style={styles.timeBlockNum}>C{blockDef.block}</Text>
              <Text style={styles.timeBlockStart}>{blockDef.startTime}</Text>
              <Text style={styles.timeBlockEnd}>{blockDef.endTime}</Text>
            </View>
          ))}
        </View>

        {/* Columnas de los 5 Días de la Semana (Lunes a Viernes) */}
        <View style={styles.daysGrid}>
          {DAYS.map((d) => {
            const isToday = currentDay === d.num
            return (
              <View key={d.num} style={styles.dayColumn}>
                {/* Cabecera del Día */}
                <View style={[styles.dayHeaderCell, isToday && styles.dayHeaderCellToday]}>
                  <Text style={[styles.dayHeaderText, isToday && styles.dayHeaderTextToday]}>
                    {d.short}
                  </Text>
                  {isToday && (
                    <View style={styles.todayIndicatorPill}>
                      <Text style={styles.todayIndicatorText}>Hoy</Text>
                    </View>
                  )}
                </View>

                {/* 4 Celdas correspondientes a los 4 bloques */}
                <View style={styles.daySlotsColumn}>
                  {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
                    const item = schedules.find(
                      (s) => s.day_of_week === d.num && s.block_number === blockDef.block
                    )
                    return (
                      <MatrixSlotCard
                        key={blockDef.block}
                        dayNum={d.num}
                        blockNum={blockDef.block}
                        schedule={item}
                        onPress={() => onSlotPress(d.num, blockDef.block, item)}
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
    backgroundColor: '#121216',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  scrollContent: {
    flexDirection: 'row',
    padding: 10,
  },
  timeColumn: {
    width: 60,
    marginRight: 8,
  },
  timeColHeader: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    marginBottom: 8,
  },
  timeColHeaderText: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeBlockCell: {
    height: 94,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  timeBlockNum: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  timeBlockStart: {
    color: '#818CF8',
    fontSize: 10,
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
    width: 128,
  },
  dayHeaderCell: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
    gap: 6,
  },
  dayHeaderCellToday: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: '#818CF8',
  },
  dayHeaderText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayHeaderTextToday: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  todayIndicatorPill: {
    backgroundColor: '#818CF8',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  todayIndicatorText: {
    color: '#09090B',
    fontSize: 9,
    fontWeight: '800',
  },
  daySlotsColumn: {
    gap: 8,
  },
  slotCardOuter: {
    height: 94,
  },
  slotCard: {
    flex: 1,
    borderRadius: 14,
    padding: 9,
    justifyContent: 'space-between',
  },
  slotCardFilled: {
    borderWidth: 1,
  },
  slotCardEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
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
  subjDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  slotBlockBadge: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9.5,
    fontWeight: '700',
  },
  slotSubjectName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: -0.2,
    marginVertical: 3,
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
    color: '#A1A1AA',
    fontSize: 9.5,
    fontWeight: '500',
    maxWidth: 95,
  },
  slotEmptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  slotEmptyText: {
    color: '#52525B',
    fontSize: 10,
    fontWeight: '600',
  },
})
