import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { BarChart2, Sparkles } from 'lucide-react-native'

type ScopeFilter = 'pending' | 'all'

interface SubjectStat {
  subjectId: string | null
  name: string
  color: string
  count: number
  percentage: number
}

export function MinimalistSubjectBalance() {
  const [scope, setScope] = useState<ScopeFilter>('pending')
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasks())
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

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
  }

  // Filtrar y calcular estadísticas
  const { stats, totalTasks, topSubject } = useMemo(() => {
    const filteredTasks = tasks.filter((t) => {
      if (scope === 'pending') {
        return t.status === 'pending'
      }
      return true
    })

    const total = filteredTasks.length
    if (total === 0) {
      return { stats: [], totalTasks: 0, topSubject: null }
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

    const top = result.length > 0 ? result[0] : null

    return { stats: result, totalTasks: total, topSubject: top }
  }, [tasks, subjects, scope])

  return (
    <View style={styles.container}>
      {/* Encabezado con selector de ámbito */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIconRow}>
          <BarChart2 size={13.5} color="#A1A1AA" />
          <Text style={styles.sectionTitle}>Distribución de Carga</Text>
        </View>

        <View style={styles.scopeToggleContainer}>
          <Pressable
            onPress={() => handleToggleScope('pending')}
            style={[styles.scopeButton, scope === 'pending' && styles.scopeButtonActive]}
          >
            <Text style={[styles.scopeButtonText, scope === 'pending' && styles.scopeButtonTextActive]}>
              Pendientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleToggleScope('all')}
            style={[styles.scopeButton, scope === 'all' && styles.scopeButtonActive]}
          >
            <Text style={[styles.scopeButtonText, scope === 'all' && styles.scopeButtonTextActive]}>
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
        <View style={styles.contentBody}>
          {/* Barra Multicromática Segmentada (Apple style) */}
          <View style={styles.segmentedBarWrapper}>
            <View style={styles.segmentedBarTrack}>
              {stats.map((item, index) => {
                const widthPercent = `${Math.max(item.percentage, 3)}%` as const
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

          {/* Micro-Insight de Conclusión */}
          {Boolean(topSubject) && (
            <View style={styles.insightBox}>
              <Sparkles size={12} color="#38BDF8" style={styles.insightIcon} />
              <Text style={styles.insightText}>
                <Text style={styles.insightBold}>{topSubject?.name}</Text> concentra el{' '}
                <Text style={styles.insightBold}>{topSubject?.percentage}%</Text> de tu carga{' '}
                {scope === 'pending' ? 'pendiente' : 'total'}.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6.5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  scopeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  scopeButton: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scopeButtonActive: {
    backgroundColor: '#27272A',
  },
  scopeButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
  },
  scopeButtonTextActive: {
    color: '#F4F4F5',
    fontWeight: '600',
  },
  contentBody: {
    gap: 12,
  },
  segmentedBarWrapper: {
    paddingVertical: 2,
  },
  segmentedBarTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#18181B',
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  segmentedBarItem: {
    height: '100%',
    borderRadius: 1,
  },
  whiteBarBorder: {
    borderColor: '#3F3F46',
    borderWidth: 1,
  },
  statsList: {
    gap: 8,
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
    width: 7.5,
    height: 7.5,
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
    fontWeight: '600',
    color: '#F4F4F5',
  },
  countText: {
    fontSize: 11.5,
    color: '#71717A',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.12)',
    marginTop: 4,
  },
  insightIcon: {
    marginRight: 7,
  },
  insightText: {
    fontSize: 11.5,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 16,
  },
  insightBold: {
    color: '#F1F5F9',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
  },
  emptyText: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
  },
})
