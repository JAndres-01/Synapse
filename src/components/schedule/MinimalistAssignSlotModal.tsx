import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import type { Subject, Schedule } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { X, Check, Trash2, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

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

  useEffect(() => {
    setDayOfWeek(initialDay)
    setBlockNumber(initialBlock)

    if (existingSchedule) {
      setSelectedSubjectId(existingSchedule.subject_id || null)
    } else {
      setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
    }
  }, [existingSchedule, initialDay, initialBlock, visible, subjects])

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
      // 1. Guardar de inmediato en almacenamiento local (0 ms)
      await personalStorage.saveScheduleSlot(slotData)
      triggerHaptic('success')
      onScheduleSaved()
      onClose()

      // 2. Intentar respaldar en Supabase en background
      supabase
        .from('schedules')
        .upsert(
          {
            id: slotData.id,
            user_id: userId,
            day_of_week: dayOfWeek,
            block_number: blockNumber,
            subject_id: selectedSubjectId,
            start_time: blockDef.startTime,
            end_time: blockDef.endTime,
          },
          { onConflict: 'user_id,day_of_week,block_number' }
        )
        .then(() => {})
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la clase.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleClearSlot = async () => {
    Alert.alert(
      '¿Marcar como Hora Libre?',
      'Se removerá la clase en este horario.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar Libre',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              await personalStorage.clearScheduleSlot(dayOfWeek, blockNumber)
              onScheduleSaved()
              onClose()
              if (existingSchedule) {
                supabase.from('schedules').delete().eq('id', existingSchedule.id).then(() => {})
              }
            } catch (err) {
              console.error('Error vaciando bloque:', err)
            }
          },
        },
      ]
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>
              {existingSchedule ? 'Editar Clase del Horario' : 'Asignar Clase'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Selector de Día */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DÍA DE LA SEMANA</Text>
              <View style={styles.daysRow}>
                {DAYS.map((d) => (
                  <Pressable
                    key={d.num}
                    onPress={() => {
                      triggerHaptic('light')
                      setDayOfWeek(d.num)
                    }}
                    style={[styles.dayPill, dayOfWeek === d.num && styles.dayPillActive]}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        dayOfWeek === d.num && styles.dayPillTextActive,
                      ]}
                    >
                      {d.name.slice(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Selector de Bloque (4 Bloques) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BLOQUE DE CLASE (1H 30M)</Text>
              <View style={styles.blocksRow}>
                {PERSONAL_SCHEDULE_BLOCKS.map((b) => (
                  <Pressable
                    key={b.block}
                    onPress={() => {
                      triggerHaptic('light')
                      setBlockNumber(b.block)
                    }}
                    style={[styles.blockBtn, blockNumber === b.block && styles.blockBtnActive]}
                  >
                    <Text
                      style={[
                        styles.blockBtnTitle,
                        blockNumber === b.block && styles.blockBtnTitleActive,
                      ]}
                    >
                      C{b.block}
                    </Text>
                    <Text style={styles.blockBtnTime}>{b.startTime}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Selector de Materia */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SELECCIONA LA MATERIA</Text>
              {subjects.length === 0 ? (
                <View style={styles.noSubjectsBox}>
                  <BookOpen size={20} color="#71717A" />
                  <Text style={styles.noSubjectsText}>
                    Aún no has registrado materias. Abre el gestor de "Materias" para crear una.
                  </Text>
                </View>
              ) : (
                <View style={styles.subjectsGrid}>
                  {subjects.map((subj) => {
                    const isSelected = selectedSubjectId === subj.id
                    const isWhite = subj.color === '#FFFFFF'

                    return (
                      <Pressable
                        key={subj.id}
                        onPress={() => {
                          triggerHaptic('light')
                          setSelectedSubjectId(subj.id)
                        }}
                        style={[
                          styles.subjCard,
                          isSelected && {
                            borderColor: subj.color || '#FFFFFF',
                            backgroundColor: 'rgba(24, 24, 27, 0.95)',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: subj.color || '#FFFFFF' },
                            isWhite && styles.whiteDotBorder,
                          ]}
                        />
                        <View style={styles.subjCardTextCol}>
                          <Text style={styles.subjCardName} numberOfLines={1}>
                            {subj.name}
                          </Text>
                          {subj.teacher_name && (
                            <Text style={styles.subjCardTeacher} numberOfLines={1}>
                              {subj.teacher_name}
                            </Text>
                          )}
                        </View>
                        {isSelected && (
                          <Check
                            size={14}
                            color={subj.color || '#FFFFFF'}
                            strokeWidth={3}
                          />
                        )}
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </View>

            {/* Botones de Acción */}
            <View style={styles.actionsContainer}>
              <Pressable
                onPress={handleSave}
                disabled={loading || subjects.length === 0}
                style={[
                  styles.saveBtn,
                  (loading || subjects.length === 0) && styles.saveBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <Check size={16} color="#09090B" strokeWidth={2.5} />
                    <Text style={styles.saveBtnText}>Asignar al Horario</Text>
                  </View>
                )}
              </Pressable>

              <Pressable onPress={handleClearSlot} style={styles.deleteSlotBtn}>
                <Trash2 size={14} color="#EF4444" />
                <Text style={styles.deleteSlotBtnText}>Dejar como Hora Libre</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#27272A',
    maxHeight: '90%',
    paddingBottom: 34,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 14,
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  inputGroup: {
    gap: 6,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dayPillActive: {
    backgroundColor: '#FFFFFF',
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  dayPillTextActive: {
    color: '#09090B',
  },
  blocksRow: {
    flexDirection: 'row',
    gap: 6,
  },
  blockBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  blockBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: '#FFFFFF',
  },
  blockBtnTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  blockBtnTitleActive: {
    color: '#FFFFFF',
  },
  blockBtnTime: {
    color: '#52525B',
    fontSize: 9.5,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  subjectsGrid: {
    gap: 6,
  },
  subjCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: '#52525B',
  },
  subjCardTextCol: {
    flex: 1,
    gap: 2,
  },
  subjCardName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  subjCardTeacher: {
    color: '#71717A',
    fontSize: 11,
  },
  noSubjectsBox: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  noSubjectsText: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionsContainer: {
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '800',
  },
  deleteSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  deleteSlotBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
})
