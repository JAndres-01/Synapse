import React, { useState, useEffect, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { BarChart2 } from 'lucide-react-native'

type ScopeFilter = 'pending' | 'all'

interface SubjectStat {
  subjectId: string | null
  name: string
  color: string
  count: number
  percentage: number
}

const TOGGLE_WIDTH = 92

export function MinimalistSubjectBalance() {
  const [scope, setScope] = useState<ScopeFilter>('pending')
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasks())
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  // Animación de rebote suave al alternar ámbito
  const slideAnim = useRef(new Animated.Value(0)).current
  const contentFadeAnim = useRef(new Animated.Value(1)).current
  const contentScaleAnim = useRef(new Animated.Value(1)).current

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

  const handleToggleScope = (newScope: ScopeFilter) => {
    if (newScope === scope) return
    triggerHaptic('selection')
    setScope(newScope)

    const targetOffset = newScope === 'pending' ? 0 : TOGGLE_WIDTH

    // Animación de pastilla con rebote físico tipo iOS
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: targetOffset,
        stiffness: 700,
        damping: 32,
        mass: 0.6,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(contentFadeAnim, {
          toValue: 0.85,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(contentFadeAnim, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.spring(contentScaleAnim, {
            toValue: 1,
            stiffness: 600,
            damping: 24,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start()
  }

  // Filtrar y calcular estadísticas
  const { stats, totalTasks } = useMemo(() => {
    const filteredTasks = tasks.filter((t) => {
      if (scope === 'pending') {
        return t.status === 'pending'
      }
      return true
    })

    const total = filteredTasks.length
    if (total === 0) {
      return { stats: [], totalTasks: 0 }
    }

    const countsMap = new Map<string, number>()
    let generalCount = 0

    filteredTasks.forEach((t) => {
      if (t.subject_id) {
        countsMap.set(t.subject_id, (countsMap.get(t.subject_id) || 0) + 1)
      } else {
        generalCount++
      }
    })

    const result: SubjectStat[] = []

    subjects.forEach((subj) => {
      const count = countsMap.get(subj.id) || 0
      if (count > 0) {
        result.push({
          subjectId: subj.id,
          name: subj.name,
          color: subj.color || '#A1A1AA',
          count,
          percentage: Math.round((count / total) * 100),
        })
      }
    })

    if (generalCount > 0) {
      result.push({
        subjectId: null,
        name: 'General',
        color: '#71717A',
        count: generalCount,
        percentage: Math.round((generalCount / total) * 100),
      })
    }

    // Ordenar de mayor a menor carga
    result.sort((a, b) => b.count - a.count)

    return { stats: result, totalTasks: total }
  }, [tasks, subjects, scope])

  return (
    <View style={styles.cardWrapper}>
      {/* Encabezado con selector de ámbito */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIconRow}>
          <BarChart2 size={14} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle}>Distribución de Carga</Text>
        </View>

        {/* Toggle Segmentado Flotante con Pastilla Animada */}
        <View style={styles.scopeToggleContainer}>
          <Animated.View
            style={[
              styles.activePill,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />

          <Pressable
            onPress={() => handleToggleScope('pending')}
            style={styles.scopeButton}
          >
            <Text
              style={[
                styles.scopeButtonText,
                scope === 'pending' && styles.scopeButtonTextActive,
              ]}
            >
              Pendientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleToggleScope('all')}
            style={styles.scopeButton}
          >
            <Text
              style={[
                styles.scopeButtonText,
                scope === 'all' && styles.scopeButtonTextActive,
              ]}
            >
              Histórico
            </Text>
          </Pressable>
        </View>
      </View>

      {totalTasks === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {scope === 'pending'
              ? 'No tienes tareas pendientes activas en este momento.'
              : 'Aún no has registrado tareas para calcular tu balance académico.'}
          </Text>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.contentBody,
            {
              opacity: contentFadeAnim,
              transform: [{ scale: contentScaleAnim }],
            },
          ]}
        >
          {/* Barra Multicromática Segmentada (Apple style) */}
          <View style={styles.segmentedBarWrapper}>
            <View style={styles.segmentedBarTrack}>
              {stats.map((item, index) => {
                const widthPercent = `${Math.max(item.percentage, 3.5)}%` as const
                return (
                  <View
                    key={item.subjectId || `gen_${index}`}
                    style={[
                      styles.segmentedBarItem,
                      {
                        width: widthPercent,
                        backgroundColor: item.color,
                      },
                      item.color === '#FFFFFF' && styles.whiteBarBorder,
                    ]}
                  />
                )
              })}
            </View>
          </View>

          {/* Lista de Filas Simétricas */}
          <View style={styles.statsList}>
            {stats.map((item, index) => {
              return (
                <View key={item.subjectId || `gen_${index}`} style={styles.statRow}>
                  <View style={styles.statLeftCol}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: item.color },
                        item.color === '#FFFFFF' && styles.whiteDotBorder,
                      ]}
                    />
                    <Text style={styles.subjectNameText} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>

                  <View style={styles.statRightCol}>
                    <Text style={styles.percentageText}>{item.percentage}%</Text>
                    <Text style={styles.countText}>
                      ({item.count} {item.count === 1 ? 'tarea' : 'tareas'})
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#131316',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242429',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F4F4F5',
    letterSpacing: -0.2,
  },
  scopeToggleContainer: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#09090B',
    borderRadius: 20,
    padding: 2.5,
    borderWidth: 1,
    borderColor: '#27272A',
    width: TOGGLE_WIDTH * 2 + 5,
  },
  activePill: {
    position: 'absolute',
    top: 2.5,
    left: 2.5,
    width: TOGGLE_WIDTH,
    bottom: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  scopeButton: {
    width: TOGGLE_WIDTH,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  scopeButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
    letterSpacing: -0.1,
  },
  scopeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentBody: {
    gap: 12,
  },
  segmentedBarWrapper: {
    paddingVertical: 2,
  },
  segmentedBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#09090B',
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
    borderWidth: 1,
    borderColor: '#1E1E22',
  },
  segmentedBarItem: {
    height: '100%',
    borderRadius: 1.5,
  },
  whiteBarBorder: {
    borderColor: '#3F3F46',
    borderWidth: 1,
  },
  statsList: {
    gap: 9,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  statLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderColor: '#3F3F46',
    borderWidth: 1,
  },
  subjectNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E4E4E7',
    flex: 1,
  },
  statRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  countText: {
    fontSize: 11.5,
    color: '#71717A',
  },
  emptyContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E1E22',
  },
  emptyText: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
  },
})
