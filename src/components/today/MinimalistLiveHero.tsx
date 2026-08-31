import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/personal'
import { calculateLiveClassStatus, type LiveStatusResult } from '@/lib/scheduleEngine'
import { MapPin, User, Clock } from 'lucide-react-native'

interface MinimalistLiveHeroProps {
  schedulesToday: Schedule[]
}

export function MinimalistLiveHero({ schedulesToday = [] }: MinimalistLiveHeroProps) {
  const [liveData, setLiveData] = useState<LiveStatusResult>(() =>
    calculateLiveClassStatus(schedulesToday)
  )

  useEffect(() => {
    setLiveData(calculateLiveClassStatus(schedulesToday))

    const interval = setInterval(() => {
      setLiveData(calculateLiveClassStatus(schedulesToday))
    }, 15000)

    return () => clearInterval(interval)
  }, [schedulesToday])

  const isLive = liveData.status === 'active'
  const isBreak = liveData.status === 'break'
  const activeSched = liveData.activeSchedule

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
            <Clock size={11} color="#A1A1AA" />
            <Text style={styles.timeTagText}>
              {activeSched.start_time} - {activeSched.end_time}
            </Text>
          </View>
        )}
      </View>

      {/* TÃ­tulo Principal */}
      <Text style={styles.headline} numberOfLines={1}>
        {liveData.headline}
      </Text>

      {/* SubtÃ­tulo / Aula / Docente */}
      <View style={styles.detailsRow}>
        {activeSched?.classroom_room && (
          <View style={styles.detailItem}>
            <MapPin size={12} color="#818CF8" />
            <Text style={styles.detailText}>{activeSched.classroom_room}</Text>
          </View>
        )}

        {activeSched?.subject?.teacher_name && (
          <View style={styles.detailItem}>
            <User size={12} color="#71717A" />
            <Text style={styles.detailText}>{activeSched.subject.teacher_name}</Text>
          </View>
        )}

        <Text style={styles.subheadline}>{liveData.subheadline}</Text>
      </View>

      {/* Barra de Progreso Minimalista (3px) */}
      {(isLive || isBreak) && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${liveData.progressPercentage}%` },
              isBreak && { backgroundColor: '#F59E0B' },
            ]}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  heroContainer: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    gap: 8,
  },
  heroContainerLive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  heroContainerBreak: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
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
    backgroundColor: '#71717A',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeTextLive: {
    color: '#34D399',
  },
  badgeTextBreak: {
    color: '#FBBF24',
  },
  badgeTextDefault: {
    color: '#A1A1AA',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#18181B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeTagText: {
    color: '#D4D4D8',
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
  },
  subheadline: {
    color: '#71717A',
    fontSize: 12,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: '#27272A',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
})
