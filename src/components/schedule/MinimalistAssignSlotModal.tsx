import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native'
import type { Subject, Schedule } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { X, Check, Trash2, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistAssignSlotModalProps {
  visible: boolean
  onClose: () => void
  userId: string
  subjects: Subject[]
  initialDay?: number
  initialBlock?: number
  existingSchedule?: Schedule | null
  onScheduleSaved: () => void
}

const DAYS = [
  { num: 1, name: 'Lunes' },
  { num: 2, name: 'Martes' },
  { num: 3, name: 'Miércoles' },
  { num: 4, name: 'Jueves' },
  { num: 5, name: 'Viernes' },
]

export function MinimalistAssignSlotModal({
  visible,
  onClose,
  userId,
  subjects = [],
  initialDay = 1,
  initialBlock = 1,
  existingSchedule,
  onScheduleSaved,
}: MinimalistAssignSlotModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState(initialDay)
  const [blockNumber, setBlockNumber] = useState(initialBlock)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Animaciones independientes para evitar arrastre de fondo negro
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const panY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(visible)

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      panY.setValue(0)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          stiffness: 480,
          damping: 32,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(panY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
      })
    }
  }, [visible, fadeAnim, slideAnim])

  useEffect(() => {
    setDayOfWeek(initialDay)
    setBlockNumber(initialBlock)

    if (existingSchedule) {
      setSelectedSubjectId(existingSchedule.subject_id || null)
    } else {
      setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
    }
  }, [existingSchedule, initialDay, initialBlock, visible, subjects])

  const handleSmoothClose = () => {
    triggerHaptic('light')
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(panY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose()
    })
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 110 || gestureState.vy > 0.5) {
          handleSmoothClose()
        } else {
          Animated.spring(panY, {
            toValue: 0,
            damping: 24,
            stiffness: 400,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  const blockDef =
    PERSONAL_SCHEDULE_BLOCKS.find((b) => b.block === blockNumber) ||
    PERSONAL_SCHEDULE_BLOCKS[0]

  const handleSave = async () => {
    if (!selectedSubjectId) {
      Alert.alert('Materia requerida', 'Por favor selecciona una materia.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    const subjectObj = subjects.find((s) => s.id === selectedSubjectId)
    const slotData: Schedule = {
      id: existingSchedule?.id || 'sched_' + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      day_of_week: dayOfWeek,
      block_number: blockNumber,
      subject_id: selectedSubjectId,
      start_time: blockDef.startTime,
      end_time: blockDef.endTime,
      subject: subjectObj,
      updated_at: new Date().toISOString(),
    }

    try {
      await personalStorage.saveScheduleSlot(slotData)
      triggerHaptic('success')
      onScheduleSaved()
      handleSmoothClose()

      supabase
        .from('schedules')
        .upsert(
          {
            id: slotData.id,
            user_id: userId,
            day_of_week: slotData.day_of_week,
            block_number: slotData.block_number,
            subject_id: slotData.subject_id,
            start_time: slotData.start_time,
            end_time: slotData.end_time,
          },
          { onConflict: 'user_id,day_of_week,block_number' }
        )
        .then(({ error }) => {
          if (error) console.log('Supabase sync slot info:', error.message)
        })
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la clase.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleClearSlot = async () => {
    setLoading(true)
    try {
      await personalStorage.clearScheduleSlot(dayOfWeek, blockNumber)
      triggerHaptic('success')
      onScheduleSaved()
      handleSmoothClose()

      supabase
        .from('schedules')
        .delete()
        .eq('user_id', userId)
        .eq('day_of_week', dayOfWeek)
        .eq('block_number', blockNumber)
        .then(() => {})
    } catch (err) {
      console.error('Error limpiando bloque:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop Estático */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante */}
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }, { translateY: panY }] }]}>
          {/* Header */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>
              {existingSchedule ? 'Editar Clase del Horario' : 'Asignar Clase'}
            </Text>
            <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Selector de Día */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>DÍA DE LA SEMANA</Text>
              <View style={styles.daySelectorRow}>
                {DAYS.map((d) => {
                  const isSelected = dayOfWeek === d.num
                  return (
                    <Pressable
                      key={d.num}
                      onPress={() => {
                        triggerHaptic('selection')
                        setDayOfWeek(d.num)
                      }}
                      style={[
                        styles.dayPill,
                        isSelected && styles.dayPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          isSelected && styles.dayPillTextActive,
                        ]}
                      >
                        {d.name.slice(0, 3)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Selector de Bloque (4 Bloques Continuos) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>BLOQUE HORARIO (1H 30M)</Text>
              <View style={styles.blocksList}>
                {PERSONAL_SCHEDULE_BLOCKS.map((b) => {
                  const isSelected = blockNumber === b.block
                  return (
                    <Pressable
                      key={b.block}
                      onPress={() => {
                        triggerHaptic('selection')
                        setBlockNumber(b.block)
                      }}
                      style={[
                        styles.blockRow,
                        isSelected && styles.blockRowActive,
                      ]}
                    >
                      <View style={styles.blockRowLeft}>
                        <View
                          style={[
                            styles.blockNumberBadge,
                            isSelected && styles.blockNumberBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.blockNumberText,
                              isSelected && styles.blockNumberTextActive,
                            ]}
                          >
                            {b.block}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.blockLabelText,
                            isSelected && styles.blockLabelTextActive,
                          ]}
                        >
                          {b.label}
                        </Text>
                      </View>

                      {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={2.5} />}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Selector de Materia */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>SELECCIONA LA MATERIA</Text>

              {subjects.length > 0 ? (
                <View style={styles.subjectsGrid}>
                  {subjects.map((s) => {
                    const isSelected = selectedSubjectId === s.id
                    const isWhite = s.color === '#FFFFFF'
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          triggerHaptic('selection')
                          setSelectedSubjectId(s.id)
                        }}
                        style={[
                          styles.subjectCard,
                          isSelected && {
                            borderColor: isWhite
                              ? 'rgba(255, 255, 255, 0.4)'
                              : `${s.color || '#FFFFFF'}70`,
                            backgroundColor: isWhite
                              ? 'rgba(255, 255, 255, 0.15)'
                              : `${s.color || '#FFFFFF'}20`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: s.color || '#FFFFFF' },
                            isWhite && styles.whiteDotBorder,
                          ]}
                        />
                        <Text style={styles.subjectCardText} numberOfLines={1}>
                          {s.name}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptySubjsNotice}>
                  No tienes materias creadas. Primero crea tus materias desde la pestaña de Horario.
                </Text>
              )}
            </View>

            {/* Botones de Acción */}
            <View style={styles.actionButtonsCol}>
              <Pressable
                onPress={handleSave}
                disabled={loading}
                style={styles.saveBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {existingSchedule ? 'Guardar Cambios' : 'Asignar al Horario'}
                  </Text>
                )}
              </Pressable>

              {existingSchedule && (
                <Pressable
                  onPress={handleClearSlot}
                  disabled={loading}
                  style={styles.clearSlotBtn}
                >
                  <Trash2 size={14} color="#EF4444" />
                  <Text style={styles.clearSlotText}>Dejar como Hora Libre</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '88%',
    paddingBottom: 36,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 6,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    top: 14,
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  inputGroup: {
    marginBottom: 16,
    gap: 6,
  },
  label: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  blocksList: {
    gap: 6,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  blockRowActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  blockRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  blockNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockNumberBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  blockNumberText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  blockNumberTextActive: {
    color: '#09090B',
  },
  blockLabelText: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
  },
  blockLabelTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subjectCardText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  emptySubjsNotice: {
    color: '#71717A',
    fontSize: 12,
    paddingVertical: 8,
  },
  actionButtonsCol: {
    gap: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
  clearSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  clearSlotText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
})
