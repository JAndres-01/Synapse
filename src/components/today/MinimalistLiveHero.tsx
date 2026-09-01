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

      {/* Título Principal */}
      <Text style={styles.headline} numberOfLines={1}>
        {liveData.headline}
      </Text>

      {/* Subtítulo / Aula / Docente */}
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
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  heroContainerLive: {
    borderColor: 'rgba(129, 140, 248, 0.4)',
    backgroundColor: '#13131A',
  },
  heroContainerBreak: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: '#181510',
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
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pulseDotLive: {
    backgroundColor: '#818CF8',
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
    color: '#818CF8',
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
    backgroundColor: '#27272A',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  timeTagText: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '600',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#A1A1AA',
    fontSize: 11.5,
  },
  subheadline: {
    color: '#71717A',
    fontSize: 11.5,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: '#27272A',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 1.5,
  },
})
