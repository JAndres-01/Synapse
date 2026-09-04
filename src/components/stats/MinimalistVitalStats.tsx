import React, { useEffect, useState, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { calculateAcademicVitalStats } from '@/lib/academicDateUtils'
import { CheckCircle2, Clock, BookOpen } from 'lucide-react-native'

export function MinimalistVitalStats() {
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasks())
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  // Animaciones de entrada escalonadas para las 3 tarjetas
  const card1Anim = useRef(new Animated.Value(0)).current
  const card2Anim = useRef(new Animated.Value(0)).current
  const card3Anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const updateData = () => {
      personalStorage.getTasks().then((t) => {
        if (t && Array.isArray(t)) setTasks(t)
      })
      personalStorage.getSubjects().then((s) => {
        if (s && Array.isArray(s)) setSubjects(s)
      })
    }
    updateData()
    const unsubscribe = subscribeToPersonalStorage(updateData)
    return unsubscribe
  }, [])

  const stats = useMemo(() => {
    return calculateAcademicVitalStats(tasks, subjects)
  }, [tasks, subjects])

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      Animated.stagger(50, [
        Animated.spring(card1Anim, {
          toValue: 1,
          stiffness: 240,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(card2Anim, {
          toValue: 1,
          stiffness: 240,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(card3Anim, {
          toValue: 1,
          stiffness: 240,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isInitialMount.current = false
      })
    }
  }, [card1Anim, card2Anim, card3Anim])

  return (
    <View style={styles.cardsRow}>
      {/* Tarjeta 1: Entregadas */}
      <Animated.View
        style={[
          styles.statCard,
          {
            opacity: card1Anim,
            transform: [
              {
                translateY: card1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
              {
                scale: card1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.iconCircleEmerald}>
          <CheckCircle2 size={15} color="#34D399" strokeWidth={2.4} />
        </View>
        <Text style={styles.statValue} numberOfLines={1}>
          {stats.completedTasksCount}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          Entregadas
        </Text>
      </Animated.View>

      {/* Tarjeta 2: Puntualidad */}
      <Animated.View
        style={[
          styles.statCard,
          {
            opacity: card2Anim,
            transform: [
              {
                translateY: card2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
              {
                scale: card2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.iconCircleSky}>
          <Clock size={15} color="#38BDF8" strokeWidth={2.4} />
        </View>
        <Text style={styles.statValue} numberOfLines={1}>
          {stats.punctualityRate}%
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          Puntualidad
        </Text>
      </Animated.View>

      {/* Tarjeta 3: Materias */}
      <Animated.View
        style={[
          styles.statCard,
          {
            opacity: card3Anim,
            transform: [
              {
                translateY: card3Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
              {
                scale: card3Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.iconCircleLavender}>
          <BookOpen size={15} color="#A78BFA" strokeWidth={2.4} />
        </View>
        <Text style={styles.statValue} numberOfLines={1}>
          {stats.activeSubjectsCount}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          Materias
        </Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#131316',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242429',
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircleEmerald: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSky: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleLavender: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
    letterSpacing: -0.2,
  },
})

