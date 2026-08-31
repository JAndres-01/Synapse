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
import { X, Plus, Trash2, BookOpen, Check, User } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

interface MinimalistSubjectModalProps {
  visible: boolean
  onClose: () => void
  userId: string
  subjects: Subject[]
  onSubjectsUpdated: () => void
}

// 8 Colores con alto contraste y sin parecidos + Blanco Puro (#FFFFFF)
const DISTINCT_PALETTE = [
  '#FFFFFF', // Blanco Puro
  '#3B82F6', // Azul Eléctrico
  '#10B981', // Verde Esmeralda
  '#EF4444', // Rojo Brillante
  '#F59E0B', // Amarillo Ámbar
  '#8B5CF6', // Morado Eléctrico
  '#EC4899', // Rosa Fucsia
  '#06B6D4', // Cian / Turquesa
]

export function MinimalistSubjectModal({
  visible,
  onClose,
  userId,
  subjects = [],
  onSubjectsUpdated,
}: MinimalistSubjectModalProps) {
  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [selectedColor, setSelectedColor] = useState(DISTINCT_PALETTE[0])
  const [loading, setLoading] = useState(false)

  const handleCreateSubject = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre de la materia.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    const newSubject: Subject = {
      id: 'subj_' + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      name: name.trim(),
      teacher_name: teacher.trim() || null,
      color: selectedColor,
      created_at: new Date().toISOString(),
    }

    try {
      // 1. Guardar de inmediato en almacenamiento local (0 ms de espera)
      await personalStorage.saveSubject(newSubject)
      triggerHaptic('success')
      setName('')
      setTeacher('')
      onSubjectsUpdated()

      // 2. Intentar sincronizar en Supabase en segundo plano
      supabase
        .from('subjects')
        .insert({
          id: newSubject.id,
          user_id: userId,
          name: newSubject.name,
          teacher_name: newSubject.teacher_name,
          color: newSubject.color,
        })
        .then(({ error }) => {
          if (error) console.log('Supabase sync info:', error.message)
        })
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la materia.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubject = (subjectId: string, subjectName: string) => {
    Alert.alert(
      '¿Eliminar materia?',
      `Se eliminará "${subjectName}" de tus materias y horarios.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              await personalStorage.removeSubject(subjectId)
              onSubjectsUpdated()
              supabase.from('subjects').delete().eq('id', subjectId).then(() => {})
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
            <Text style={styles.sheetTitle}>Configurar Materias</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Formulario con Solo 3 Campos: Nombre, Profesor y Color */}
            <View style={styles.formCard}>
              <Text style={styles.formCardTitle}>AGREGAR MATERIA</Text>

              {/* 1. Nombre de la Materia */}
              <View style={styles.inputBox}>
                <BookOpen size={14} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  placeholder="Nombre de la materia (ej. Cálculo)"
                  placeholderTextColor="#52525B"
                  value={name}
                  onChangeText={setName}
                  style={styles.textInput}
                />
              </View>

              {/* 2. Nombre del Profesor */}
              <View style={styles.inputBox}>
                <User size={14} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  placeholder="Nombre del profesor (opcional)"
                  placeholderTextColor="#52525B"
                  value={teacher}
                  onChangeText={setTeacher}
                  style={styles.textInput}
                />
              </View>

              {/* 3. Selector de Color (Paleta Distintiva con Blanco) */}
              <Text style={styles.paletteLabel}>SELECCIONA UN COLOR</Text>
              <View style={styles.paletteRow}>
                {DISTINCT_PALETTE.map((col) => {
                  const isWhite = col === '#FFFFFF'
                  const isSelected = selectedColor === col

                  return (
                    <Pressable
                      key={col}
                      onPress={() => {
                        triggerHaptic('light')
                        setSelectedColor(col)
                      }}
                      style={[
                        styles.colorDot,
                        { backgroundColor: col },
                        isWhite && styles.whiteDotBorder,
                        isSelected && styles.colorDotSelected,
                      ]}
                    >
                      {isSelected && (
                        <Check
                          size={13}
                          color={isWhite ? '#09090B' : '#FFFFFF'}
                          strokeWidth={3}
                        />
                      )}
                    </Pressable>
                  )
                })}
              </View>

              {/* Botón Guardar */}
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

            {/* Lista de Materias Existentes */}
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>
                MIS MATERIAS ({subjects.length})
              </Text>

              {subjects.map((subj) => (
                <View key={subj.id} style={styles.subjectItem}>
                  <View
                    style={[
                      styles.subjectColorBar,
                      { backgroundColor: subj.color || '#FFFFFF' },
                    ]}
                  />
                  <View style={styles.subjectItemInfo}>
                    <Text style={styles.subjectItemName} numberOfLines={1}>
                      {subj.name}
                    </Text>
                    {subj.teacher_name ? (
                      <Text style={styles.subjectItemDetails}>
                        {subj.teacher_name}
                      </Text>
                    ) : (
                      <Text style={styles.subjectItemNoTeacher}>Sin profesor asignado</Text>
                    )}
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
  paletteLabel: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  paletteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: '#52525B',
  },
  colorDotSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
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
    color: '#A1A1AA',
    fontSize: 11,
  },
  subjectItemNoTeacher: {
    color: '#52525B',
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteSubjBtn: {
    padding: 6,
  },
})
