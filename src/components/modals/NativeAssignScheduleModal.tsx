import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native'
import type { Subject, Schedule } from '@/types/database'
import { SCHEDULE_BLOCKS } from '@/lib/utils'
import { X, Calendar, Clock, MapPin, Check, Video, Trash2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import { supabase } from '@/lib/nativeSupabase'

interface NativeAssignScheduleModalProps {
  visible: boolean
  onClose: () => void
  classroomId: string
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

export function NativeAssignScheduleModal({
  visible,
  onClose,
  classroomId,
  subjects = [],
  initialDay = 1,
  initialBlock = 1,
  existingSchedule,
  onScheduleSaved,
}: NativeAssignScheduleModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState(initialDay)
  const [blockNumber, setBlockNumber] = useState(initialBlock)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [classroomRoom, setClassroomRoom] = useState('')
  const [isVirtual, setIsVirtual] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDayOfWeek(initialDay)
    setBlockNumber(initialBlock)

    if (existingSchedule) {
      setSelectedSubjectId(existingSchedule.subject_id || null)
      setClassroomRoom(existingSchedule.classroom_room || '')
      setIsVirtual(Boolean(existingSchedule.is_virtual))
    } else {
      setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
      setClassroomRoom('')
      setIsVirtual(false)
    }
  }, [existingSchedule, initialDay, initialBlock, visible, subjects])

  const selectedBlockDef = SCHEDULE_BLOCKS.find((b) => b.block === blockNumber) || SCHEDULE_BLOCKS[0]

  const handleSave = async () => {
    if (!selectedSubjectId) {
      Alert.alert('Campo requerido', 'Por favor selecciona una materia.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    try {
      const payload = {
        classroom_id: classroomId,
        day_of_week: dayOfWeek,
        block_number: blockNumber,
        subject_id: selectedSubjectId,
        start_time: selectedBlockDef.startTime,
        end_time: selectedBlockDef.endTime,
        classroom_room: classroomRoom.trim() || null,
        is_virtual: isVirtual,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('schedules')
        .upsert(payload, { onConflict: 'classroom_id,day_of_week,block_number' })

      if (error) throw error

      triggerHaptic('success')
      onScheduleSaved()
      onClose()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo asignar el bloque.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSlot = async () => {
    if (!existingSchedule) return

    Alert.alert(
      '¿Vaciar este bloque?',
      'Se removerá la clase asignada en este horario.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              await supabase.from('schedules').delete().eq('id', existingSchedule.id)
              onScheduleSaved()
              onClose()
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
              {existingSchedule ? 'Editar Clase del Horario' : 'Asignar Horario'}
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
                    <Text style={[styles.dayPillText, dayOfWeek === d.num && styles.dayPillTextActive]}>
                      {d.name.slice(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Selector de Bloque / Horario */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BLOQUE DE CLASE</Text>
              <View style={styles.blocksRow}>
                {SCHEDULE_BLOCKS.map((b) => (
                  <Pressable
                    key={b.block}
                    onPress={() => {
                      triggerHaptic('light')
                      setBlockNumber(b.block)
                    }}
                    style={[styles.blockBtn, blockNumber === b.block && styles.blockBtnActive]}
                  >
                    <Text style={[styles.blockBtnTitle, blockNumber === b.block && styles.blockBtnTitleActive]}>
                      Clase {b.block}
                    </Text>
                    <Text style={styles.blockBtnTime}>{b.startTime}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Selector de Materia */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SELECCIONA LA MATERIA</Text>
              <View style={styles.subjectsGrid}>
                {subjects.map((subj) => {
                  const isSelected = selectedSubjectId === subj.id
                  return (
                    <Pressable
                      key={subj.id}
                      onPress={() => {
                        triggerHaptic('light')
                        setSelectedSubjectId(subj.id)
                      }}
                      style={[
                        styles.subjCard,
                        isSelected && { borderColor: subj.color || '#6366F1', backgroundColor: 'rgba(24, 24, 27, 0.9)' },
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: subj.color || '#6366F1' }]} />
                      <Text style={styles.subjCardName} numberOfLines={1}>
                        {subj.name}
                      </Text>
                      {isSelected && <Check size={13} color={subj.color || '#6366F1'} strokeWidth={3} />}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Aula o Salón */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AULA / SALÓN (OPCIONAL)</Text>
              <View style={styles.inputBox}>
                <MapPin size={14} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  placeholder="Ej. Aula 302, Laboratorio B"
                  placeholderTextColor="#52525B"
                  value={classroomRoom}
                  onChangeText={setClassroomRoom}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Switch Clase Virtual */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Clase Virtual / Libre</Text>
                <Text style={styles.switchSub}>Marca si es remota o autoestudio</Text>
              </View>
              <Switch
                value={isVirtual}
                onValueChange={(val) => {
                  triggerHaptic('light')
                  setIsVirtual(val)
                }}
                trackColor={{ false: '#27272A', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Botones de Acción */}
            <View style={styles.actionsContainer}>
              <Pressable
                onPress={handleSave}
                disabled={loading}
                style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <Check size={16} color="#09090B" strokeWidth={2.5} />
                    <Text style={styles.saveBtnText}>Guardar en Horario</Text>
                  </View>
                )}
              </Pressable>

              {existingSchedule && (
                <Pressable onPress={handleDeleteSlot} style={styles.deleteSlotBtn}>
                  <Trash2 size={14} color="#EF4444" />
                  <Text style={styles.deleteSlotBtnText}>Vaciar este bloque</Text>
                </Pressable>
              )}
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
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#818CF8',
  },
  blockBtnTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  blockBtnTitleActive: {
    color: '#A5B4FC',
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
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjCardName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    height: 42,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },
  switchInfo: {
    gap: 2,
  },
  switchTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  switchSub: {
    color: '#71717A',
    fontSize: 11,
  },
  actionsContainer: {
    gap: 8,
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
    opacity: 0.6,
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
