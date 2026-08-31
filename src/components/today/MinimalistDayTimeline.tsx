import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MapPin } from 'lucide-react-native'

interface MinimalistDayTimelineProps {
  schedulesToday: Schedule[]
}

export function MinimalistDayTimeline({ schedulesToday = [] }: MinimalistDayTimelineProps) {
  const now = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CRONOGRAMA DE HOY (4 BLOQUES)</Text>

      <View style={styles.timelineList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, index) => {
          const [startH, startM] = blockDef.startTime.split(':').map(Number)
          const [endH, endM] = blockDef.endTime.split(':').map(Number)
          const startTotal = startH * 60 + startM
          const endTotal = endH * 60 + endM

          const isCurrent = currentMins >= startTotal && currentMins < endTotal
          const isPast = currentMins >= endTotal

          const sched = schedulesToday.find((s) => s.block_number === blockDef.block)

          return (
            <View key={blockDef.block} style={styles.blockRow}>
              {/* Columna de Hora */}
              <View style={styles.timeCol}>
                <Text
                  style={[
                    styles.timeText,
                    isCurrent && styles.timeTextCurrent,
                    isPast && styles.timeTextPast,
                  ]}
                >
                  {blockDef.startTime}
                </Text>
                <Text style={styles.blockNumText}>C{blockDef.block}</Text>
              </View>

              {/* Indicador de LÃ­nea Vertical */}
              <View style={styles.lineCol}>
                <View
                  style={[
                    styles.lineDot,
                    isCurrent && styles.lineDotCurrent,
                    isPast && styles.lineDotPast,
                    sched?.subject && { backgroundColor: sched.subject.color || '#6366F1' },
                  ]}
                />
                {index < PERSONAL_SCHEDULE_BLOCKS.length - 1 && (
                  <View
                    style={[
                      styles.verticalLine,
                      isPast && styles.verticalLinePast,
                    ]}
                  />
                )}
              </View>

              {/* InformaciÃ³n de la Clase */}
              <View
                style={[
                  styles.contentCol,
                  isCurrent && styles.contentColCurrent,
                ]}
              >
                {sched?.subject ? (
                  <>
                    <Text
                      style={[
                        styles.subjectTitle,
                        isPast && styles.subjectTitlePast,
                      ]}
                      numberOfLines={1}
                    >
                      {sched.subject.name}
                    </Text>
                    <View style={styles.subInfoRow}>
                      {sched.classroom_room && (
                        <View style={styles.roomTag}>
                          <MapPin size={11} color="#818CF8" />
                          <Text style={styles.roomText}>{sched.classroom_room}</Text>
                        </View>
                      )}
                      {sched.subject.teacher_name && (
                        <Text style={styles.teacherText} numberOfLines={1}>
                          {sched.subject.teacher_name}
                        </Text>
                      )}
                    </View>
                  </>
                ) : (
                  <Text style={styles.freeText}>Sin clase asignada</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  timelineList: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    gap: 12,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeCol: {
    width: 48,
    alignItems: 'flex-start',
    paddingTop: 1,
  },
  timeText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  timeTextCurrent: {
    color: '#34D399',
    fontWeight: '800',
  },
  timeTextPast: {
    color: '#52525B',
  },
  blockNumText: {
    color: '#52525B',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 1,
  },
  lineCol: {
    width: 20,
    alignItems: 'center',
    paddingTop: 4,
    position: 'relative',
  },
  lineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#52525B',
    zIndex: 2,
  },
  lineDotCurrent: {
    backgroundColor: '#10B981',
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  lineDotPast: {
    backgroundColor: '#3F3F46',
  },
  verticalLine: {
    position: 'absolute',
    top: 11,
    bottom: -16,
    width: 1,
    backgroundColor: '#27272A',
  },
  verticalLinePast: {
    backgroundColor: '#27272A',
  },
  contentCol: {
    flex: 1,
    paddingLeft: 8,
    gap: 2,
  },
  contentColCurrent: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 8,
    padding: 6,
    marginLeft: 4,
  },
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subjectTitlePast: {
    color: '#71717A',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  roomText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '500',
  },
  teacherText: {
    color: '#71717A',
    fontSize: 11,
  },
  freeText: {
    color: '#52525B',
    fontSize: 12,
    fontStyle: 'italic',
  },
})
