import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/personal'
import { calculateLiveClassStatus } from '@/lib/scheduleEngine'
import { MapPin, User, Clock, Sparkles } from 'lucide-react-native'

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
    <View
      style={[
        styles.heroContainer,
        isLive && styles.heroContainerLive,
        isBreak && styles.heroContainerBreak,
      ]}
    >
      {/* Cabecera con Estado y Badge */}
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

      {/* Título Principal */}
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

      {/* Subtítulo / Aula / Docente */}
      <View style={styles.detailsRow}>
        {Boolean(activeSched?.classroom_room) && (
          <View style={styles.detailItem}>
            <MapPin size={11.5} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.classroom_room}</Text>
          </View>
        )}

        {Boolean(activeSched?.subject?.teacher_name) && (
          <View style={styles.detailItem}>
            <User size={11.5} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.subject!.teacher_name}</Text>
          </View>
        )}

        <Text style={styles.subheadline}>{liveData.subheadline}</Text>
      </View>

      {/* Barra de Progreso Minimalista Fina (2.5px) */}
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
  heroContainer: {
    backgroundColor: '#101014',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  heroContainerLive: {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  heroContainerBreak: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
    backgroundColor: 'rgba(245, 158, 11, 0.03)',
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
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
  },
  pulseDotLive: {
    backgroundColor: '#FFFFFF',
  },
  pulseDotBreak: {
    backgroundColor: '#F59E0B',
  },
  pulseDotDefault: {
    backgroundColor: '#52525B',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  badgeTextLive: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 4.5,
  },
  timeTagText: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  detailText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '500',
  },
  subheadline: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
