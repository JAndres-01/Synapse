import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/personal'
import { calculateLiveClassStatus } from '@/lib/scheduleEngine'
import { MapPin, User, Clock } from 'lucide-react-native'

interface MinimalistLiveHeroProps {
  schedulesToday: Schedule[]
}

export function MinimalistLiveHero({ schedulesToday = [] }: MinimalistLiveHeroProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const liveData = useMemo(
    () => calculateLiveClassStatus(schedulesToday),
    [schedulesToday]
  )

  const isLive = liveData.status === 'active'
  const isBreak = (liveData as any).status === 'break'
  const activeSched = liveData.activeSchedule
  const subjColor = activeSched?.subject?.color || '#FFFFFF'
  const isWhite = subjColor === '#FFFFFF'

  return (
    <View style={styles.container}>
      {/* Fila Superior de Estado y Hora */}
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.pulseDot,
              isLive ? styles.pulseDotLive : isBreak ? styles.pulseDotBreak : styles.pulseDotDefault,
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              isLive ? styles.badgeTextLive : isBreak ? styles.badgeTextBreak : styles.badgeTextDefault,
            ]}
          >
            {liveData.badgeText.toUpperCase()}
          </Text>
        </View>

        {activeSched && (
          <View style={styles.timeTag}>
            <Clock size={11} color="#71717A" />
            <Text style={styles.timeTagText}>
              {activeSched.start_time} - {activeSched.end_time}
            </Text>
          </View>
        )}
      </View>

      {/* Nombre de la Clase / Titular */}
      <View style={styles.titleRow}>
        {activeSched?.subject && (
          <View
            style={[
              styles.subjectDot,
              { backgroundColor: subjColor },
              isWhite && styles.whiteDotBorder,
            ]}
          />
        )}
        <Text style={styles.headline} numberOfLines={1}>
          {liveData.headline}
        </Text>
      </View>

      {/* Detalles: Aula, Docente y Subtítulo */}
      <View style={styles.detailsRow}>
        {Boolean(activeSched?.classroom_room) && (
          <View style={styles.detailItem}>
            <MapPin size={11} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.classroom_room}</Text>
          </View>
        )}

        {Boolean(activeSched?.subject?.teacher_name) && (
          <View style={styles.detailItem}>
            <User size={11} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.subject!.teacher_name}</Text>
          </View>
        )}

        <Text style={styles.subheadline}>{liveData.subheadline}</Text>
      </View>

      {/* Barra de Progreso Fina Integrada */}
      {(isLive || isBreak) && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${liveData.progressPercentage}%` },
              isBreak && styles.progressBarFillBreak,
            ]}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pulseDotLive: {
    backgroundColor: '#10B981',
  },
  pulseDotBreak: {
    backgroundColor: '#F59E0B',
  },
  pulseDotDefault: {
    backgroundColor: '#52525B',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  badgeTextLive: {
    color: '#10B981',
  },
  badgeTextBreak: {
    color: '#F59E0B',
  },
  badgeTextDefault: {
    color: '#71717A',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTagText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  detailText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '500',
  },
  subheadline: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  progressBarFillBreak: {
    backgroundColor: '#F59E0B',
  },
})
