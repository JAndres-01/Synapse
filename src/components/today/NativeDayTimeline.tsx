import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule, Task } from '@/types/database'
import { SCHEDULE_BLOCKS } from '@/lib/utils'
import { MapPin, Video, User } from 'lucide-react-native'

interface NativeDayTimelineProps {
  schedulesToday?: Schedule[]
  tasksToday?: Task[]
}

export function NativeDayTimeline({
  schedulesToday = [],
  tasksToday = [],
}: NativeDayTimelineProps) {
  const classes = SCHEDULE_BLOCKS.map((def) => {
    const scheduledClass = (schedulesToday || []).find((s) => s.block_number === def.block)
    const classTasks = scheduledClass?.subject_id
      ? tasksToday.filter((t) => t.subject_id === scheduledClass.subject_id)
      : []

    return {
      ...def,
      scheduledClass,
      classTasks,
    }
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cronograma de Hoy (4 Clases)</Text>
        <Text style={styles.sub}>7:00 AM - 1:00 PM</Text>
      </View>

      <View style={styles.list}>
        {classes.map((c) => {
          const item = c.scheduledClass

          return (
            <View
              key={c.block}
              style={[
                styles.blockCard,
                !item && styles.blockCardEmpty,
              ]}
            >
              {/* Header del bloque */}
              <View style={styles.blockHeader}>
                <View style={styles.blockTimeRow}>
                  <View style={styles.blockBadge}>
                    <Text style={styles.blockBadgeText}>Clase {c.block}</Text>
                  </View>
                  <Text style={styles.blockTimeText}>
                    {c.startTime} - {c.endTime}
                  </Text>
                </View>

                {item?.is_virtual && (
                  <View style={styles.virtualBadge}>
                    <Video size={10} color="#818CF8" />
                    <Text style={styles.virtualBadgeText}>Virtual / Libre</Text>
                  </View>
                )}
              </View>

              {item ? (
                <View style={styles.blockBody}>
                  <View style={styles.subjectRow}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: item.subject?.color || '#FFFFFF' },
                      ]}
                    />
                    <Text style={styles.subjectName} numberOfLines={1}>
                      {item.subject?.name || 'Materia'}
                    </Text>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <MapPin size={11} color="#52525B" />
                      <Text style={styles.detailText}>
                        {item.classroom_room || 'Aula Principal'}
                      </Text>
                    </View>
                    {item.subject?.teacher_name && (
                      <View style={styles.detailItem}>
                        <User size={11} color="#52525B" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {item.subject.teacher_name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.emptyBody}>
                  <Text style={styles.emptyText}>Sin materia asignada</Text>
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
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  title: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  sub: {
    color: '#71717A',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  list: {
    gap: 8,
  },
  blockCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    gap: 8,
  },
  blockCardEmpty: {
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
    borderColor: '#18181B',
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
  blockBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  blockBadgeText: {
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
    borderRadius: 12,
  },
  virtualBadgeText: {
    color: '#A5B4FC',
    fontSize: 9.5,
    fontWeight: '600',
  },
  blockBody: {
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
    fontSize: 13,
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
    gap: 3,
  },
  detailText: {
    color: '#71717A',
    fontSize: 11,
  },
  emptyBody: {
    paddingLeft: 2,
  },
  emptyText: {
    color: '#52525B',
    fontSize: 11,
    fontStyle: 'italic',
  },
})
