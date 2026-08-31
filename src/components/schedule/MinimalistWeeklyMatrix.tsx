import React from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import type { Schedule, Subject } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  subjects: Subject[]
  onSlotPress: (day: number, block: number, existing?: Schedule) => void
}

const DAYS = [
  { num: 1, name: 'Lun' },
  { num: 2, name: 'Mar' },
  { num: 3, name: 'MiÃ©' },
  { num: 4, name: 'Jue' },
  { num: 5, name: 'Vie' },
]

export function MinimalistWeeklyMatrix({
  schedules = [],
  subjects = [],
  onSlotPress,
}: MinimalistWeeklyMatrixProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.gridContainer}>
        {/* Cabecera de DÃ­as */}
        <View style={styles.row}>
          <View style={[styles.cellHeader, styles.timeCol]}>
            <Text style={styles.colHeaderText}>HORA</Text>
          </View>
          {DAYS.map((d) => (
            <View key={d.num} style={styles.cellHeader}>
              <Text style={styles.colHeaderText}>{d.name}</Text>
            </View>
          ))}
        </View>

        {/* 4 Filas de Bloques */}
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => (
          <View key={blockDef.block} style={styles.row}>
            {/* Columna de Hora */}
            <View style={[styles.cell, styles.timeCol]}>
              <Text style={styles.blockNumText}>C{blockDef.block}</Text>
              <Text style={styles.timeText}>{blockDef.startTime}</Text>
            </View>

            {/* 5 Celdas de Lunes a Viernes */}
            {DAYS.map((d) => {
              const item = schedules.find(
                (s) => s.day_of_week === d.num && s.block_number === blockDef.block
              )

              return (
                <Pressable
                  key={d.num}
                  onPress={() => {
                    triggerHaptic('light')
                    onSlotPress(d.num, blockDef.block, item)
                  }}
                  style={[
                    styles.cell,
                    styles.slotCell,
                    item?.subject && {
                      backgroundColor: `${item.subject.color || '#6366F1'}15`,
                      borderColor: `${item.subject.color || '#6366F1'}35`,
                    },
                  ]}
                >
                  {item?.subject ? (
                    <View style={styles.cellContent}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: item.subject.color || '#6366F1' },
                        ]}
                      />
                      <Text style={styles.subjectText} numberOfLines={2}>
                        {item.subject.name}
                      </Text>
                      {item.classroom_room ? (
                        <Text style={styles.roomText} numberOfLines={1}>
                          {item.classroom_room}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.emptyDash}>-</Text>
                  )}
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  gridContainer: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    minWidth: 380,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  timeCol: {
    width: 58,
    backgroundColor: '#09090B',
    borderRightWidth: 1,
    borderRightColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellHeader: {
    flex: 1,
    minWidth: 64,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
  },
  colHeaderText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cell: {
    flex: 1,
    minWidth: 64,
    minHeight: 68,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#27272A',
  },
  slotCell: {
    backgroundColor: '#18181B',
  },
  cellContent: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  subjectText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  roomText: {
    color: '#818CF8',
    fontSize: 8.5,
    textAlign: 'center',
  },
  blockNumText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  timeText: {
    color: '#71717A',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  emptyDash: {
    color: '#3F3F46',
    fontSize: 14,
  },
})
