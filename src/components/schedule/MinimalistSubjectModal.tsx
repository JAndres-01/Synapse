import React, { useState } from 'react'
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
} from 'react-native'
import type { Subject } from '@/types/personal'
import { X, Plus, Trash2, BookOpen, Check, User, Hash, MapPin } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { supabase } from '@/lib/personalSupabase'

interface MinimalistSubjectModalProps {
  visible: boolean
  onClose: () => void
  userId: string
  subjects: Subject[]
  onSubjectsUpdated: () => void
}

const PALETTE = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#0EA5E9', // Sky
  '#EC4899', // Pink
  '#14B8A6', // Teal
]

export function MinimalistSubjectModal({
  visible,
  onClose,
  userId,
  subjects = [],
  onSubjectsUpdated,
}: MinimalistSubjectModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [teacher, setTeacher] = useState('')
  const [room, setRoom] = useState('')
  const [selectedColor, setSelectedColor] = useState(PALETTE[0])
  const [loading, setLoading] = useState(false)

  const handleCreateSubject = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre de la materia.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from('subjects').insert({
        user_id: userId,
        name: name.trim(),
        code: code.trim() || null,
        teacher_name: teacher.trim() || null,
        classroom_room: room.trim() || null,
        color: selectedColor,
      })

      if (error) throw error

      triggerHaptic('success')
      setName('')
      setCode('')
      setTeacher('')
      setRoom('')
      onSubjectsUpdated()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear la materia.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubject = (subjectId: string, subjectName: string) => {
    Alert.alert(
      '¿Eliminar materia?',
      `Se eliminará "${subjectName}" y sus bloques del horario.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              await supabase.from('subjects').delete().eq('id', subjectId)
              onSubjectsUpdated()
            } catch (err) {
              console.error('Error eliminando materia:', err)
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
            <Text style={styles.sheetTitle}>Mis Materias</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Formulario Nueva Materia */}
            <View style={styles.formCard}>
              <Text style={styles.formCardTitle}>CREAR NUEVA MATERIA</Text>

              <View style={styles.inputBox}>
                <BookOpen size={14} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  placeholder="Nombre (ej. Cálculo Diferencial)"
                  placeholderTextColor="#52525B"
                  value={name}
                  onChangeText={setName}
                  style={styles.textInput}
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Hash size={14} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Código"
                    placeholderTextColor="#52525B"
                    value={code}
                    onChangeText={setCode}
                    style={styles.textInput}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={[styles.inputBox, { flex: 1 }]}>
                  <MapPin size={14} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Aula (ej. 302)"
                    placeholderTextColor="#52525B"
                    value={room}
                    onChangeText={setRoom}
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.inputBox}>
                <User size={14} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  placeholder="Profesor / Docente"
                  placeholderTextColor="#52525B"
                  value={teacher}
                  onChangeText={setTeacher}
                  style={styles.textInput}
                />
              </View>

              {/* Selector de Color */}
              <View style={styles.paletteRow}>
                {PALETTE.map((col) => (
                  <Pressable
                    key={col}
                    onPress={() => {
                      triggerHaptic('light')
                      setSelectedColor(col)
                    }}
                    style={[
                      styles.colorDot,
                      { backgroundColor: col },
                      selectedColor === col && styles.colorDotSelected,
                    ]}
                  >
                    {selectedColor === col && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleCreateSubject}
                disabled={loading}
                style={[styles.addBtn, loading && styles.addBtnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <View style={styles.addBtnContent}>
                    <Plus size={14} color="#09090B" strokeWidth={2.5} />
                    <Text style={styles.addBtnText}>Guardar Materia</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Lista de Materias Creadas */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>
                MATERIAS REGISTRADAS ({subjects.length})
              </Text>

              {subjects.map((subj) => (
                <View key={subj.id} style={styles.subjectItem}>
                  <View style={[styles.subjectColorBar, { backgroundColor: subj.color || '#6366F1' }]} />
                  <View style={styles.subjectItemInfo}>
                    <Text style={styles.subjectItemName} numberOfLines={1}>
                      {subj.name}
                    </Text>
                    <Text style={styles.subjectItemDetails}>
                      {subj.code ? `${subj.code} â€¢ ` : ''}
                      {subj.classroom_room ? `Aula ${subj.classroom_room} â€¢ ` : ''}
                      {subj.teacher_name || 'Sin docente'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleDeleteSubject(subj.id, subj.name)}
                    hitSlop={10}
                    style={styles.deleteSubjBtn}
                  >
                    <Trash2 size={15} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
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
    maxHeight: '85%',
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
  formCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 10,
  },
  formCardTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 10,
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
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  paletteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  addBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '700',
  },
  listSection: {
    marginTop: 20,
    gap: 8,
    marginBottom: 20,
  },
  listSectionTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 10,
  },
  subjectColorBar: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  subjectItemInfo: {
    flex: 1,
    gap: 2,
  },
  subjectItemName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  subjectItemDetails: {
    color: '#71717A',
    fontSize: 11,
  },
  deleteSubjBtn: {
    padding: 6,
  },
})
