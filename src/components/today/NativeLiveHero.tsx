import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/database'
import { getCurrentClassState, formatMinutesHuman, type CurrentClassState } from '@/lib/schedule-utils'
import { MapPin, User, Moon, Coffee, Sparkles, Video } from 'lucide-react-native'

interface NativeLiveHeroProps {
  schedulesToday?: Schedule[]
}

export function NativeLiveHero({ schedulesToday = [] }: NativeLiveHeroProps) {
  const [classState, setClassState] = useState<CurrentClassState>({
    status: 'no_classes',
  })

  useEffect(() => {
    const update = () => {
      setClassState(getCurrentClassState(schedulesToday))
    }
    update()
    const timer = setInterval(update, 20000)
    return () => clearInterval(timer)
  }, [schedulesToday])

  const { status, currentSchedule, nextSchedule, minutesRemaining, minutesUntilNext, progressPercent } =
    classState

  const formatTimeRange = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return ''
    return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`
  }

  return (
    <View style={styles.card}>
      {/* 1. CLASE EN CURSO */}
      {status === 'active' && currentSchedule && (
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.badgeActive}>
              <View style={styles.pulseDot} />
              <Text style={styles.badgeActiveText}>
                EN CURSO • CLASE {currentSchedule.block_number}
              </Text>
            </View>
            <Text style={styles.timeRemainingText}>
              Termina en {formatMinutesHuman(minutesRemaining)}
            </Text>
          </View>

          <View style={styles.subjectRow}>
            <View
              style={[
                styles.subjectDot,
                { backgroundColor: currentSchedule.subject?.color || '#6366F1' },
              ]}
            />
            <Text style={styles.subjectTitle} numberOfLines={1}>
              {currentSchedule.subject?.name || 'Materia'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={12} color="#71717A" />
              <Text style={styles.metaText}>
                {currentSchedule.classroom_room || 'Aula Principal'}
              </Text>
            </View>
            {currentSchedule.subject?.teacher_name && (
              <View style={styles.metaItem}>
                <User size={12} color="#71717A" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {currentSchedule.subject.teacher_name}
                </Text>
              </View>
            )}
          </View>

          {/* Barra de progreso */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent || 0}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* 2. RECESO / PRÓXIMA CLASE */}
      {status === 'upcoming' && nextSchedule && (
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.badgeUpcoming}>
              <Coffee size={12} color="#F59E0B" />
              <Text style={styles.badgeUpcomingText}>
                PRÓXIMA CLASE • EN {formatMinutesHuman(minutesUntilNext)}
              </Text>
            </View>
            <Text style={styles.timeRangeText}>
              {formatTimeRange(nextSchedule.start_time, nextSchedule.end_time)}
            </Text>
          </View>

          <View style={styles.subjectRow}>
            <View
              style={[
                styles.subjectDot,
                { backgroundColor: nextSchedule.subject?.color || '#F59E0B' },
              ]}
            />
            <Text style={styles.subjectTitle} numberOfLines={1}>
              {nextSchedule.subject?.name || 'Materia'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={12} color="#71717A" />
              <Text style={styles.metaText}>
                {nextSchedule.classroom_room || 'Aula Principal'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. JORNADA CONCLUIDA / FIN DE SEMANA */}
      {(status === 'completed' || status === 'no_classes') && (
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.badgeDone}>
              <Moon size={12} color="#818CF8" />
              <Text style={styles.badgeDoneText}>
                {status === 'completed' ? 'JORNADA CONCLUIDA' : 'SIN CLASES HOY'}
              </Text>
            </View>
          </View>

          <Text style={styles.doneTitle}>
            {status === 'completed'
              ? 'Has terminado tus clases de hoy'
              : 'Día libre o sin horario asignado'}
          </Text>
          <Text style={styles.doneSub}>
            Revisa tus tareas pendientes o prepara tu próximo día
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  content: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  badgeActiveText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeRemainingText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  badgeUpcoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(120, 53, 15, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeUpcomingText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  timeRangeText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  badgeDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(49, 46, 129, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeDoneText: {
    color: '#A5B4FC',
    fontSize: 10,
    fontWeight: '700',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  progressBarBg: {
    width: '100%',
    height: 5,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  doneSub: {
    color: '#71717A',
    fontSize: 12,
  },
})
