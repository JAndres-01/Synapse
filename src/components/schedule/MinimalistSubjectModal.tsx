import React, { useState, useEffect, useRef } from 'react'
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
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native'
import type { Subject } from '@/types/personal'
import { X, Plus, Trash2, BookOpen, Check, User, Pencil, RotateCcw } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistSubjectModalProps {
  visible: boolean
  onClose: () => void
  userId: string
  subjects: Subject[]
  onSubjectsUpdated: () => void
}

// 8 Colores de alto contraste + Blanco Puro (#FFFFFF)
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
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [selectedColor, setSelectedColor] = useState(DISTINCT_PALETTE[0])
  const [loading, setLoading] = useState(false)

  // Animaciones del Modal y Gesto de Deslizar
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
          duration: 200,
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
        resetForm()
      })
    }
  }, [visible, fadeAnim, slideAnim])

  const resetForm = () => {
    setEditingSubject(null)
    setName('')
    setTeacher('')
    setSelectedColor(DISTINCT_PALETTE[0])
  }

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
      resetForm()
      onClose()
    })
  }

  // PanResponder Robusto para Deslizar Hacia Abajo y Cerrar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 90 || gestureState.vy > 0.4) {
          handleSmoothClose()
        } else {
          Animated.spring(panY, {
            toValue: 0,
            damping: 22,
            stiffness: 400,
            useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, {
          toValue: 0,
          damping: 22,
          stiffness: 400,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  const handleStartEdit = (subject: Subject) => {
    triggerHaptic('selection')
    setEditingSubject(subject)
    setName(subject.name)
    setTeacher(subject.teacher_name || '')
    setSelectedColor(subject.color || DISTINCT_PALETTE[0])
  }

  const handleCancelEdit = () => {
    triggerHaptic('light')
    resetForm()
  }

  const handleSaveSubject = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre de la materia.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    try {
      if (editingSubject) {
        // MODO EDICIÓN
        const updatedSubject: Subject = {
          ...editingSubject,
          name: name.trim(),
          teacher_name: teacher.trim() || null,
          color: selectedColor,
        }

        await personalStorage.saveSubject(updatedSubject)
        triggerHaptic('success')
        resetForm()
        onSubjectsUpdated()

        supabase
          .from('subjects')
          .update({
            name: updatedSubject.name,
            teacher_name: updatedSubject.teacher_name,
            color: updatedSubject.color,
          })
          .eq('id', editingSubject.id)
          .then(({ error }) => {
            if (error) console.log('Supabase update subject info:', error.message)
          })
      } else {
        // MODO CREACIÓN
        const newSubject: Subject = {
          id: 'subj_' + Math.random().toString(36).substring(2, 11),
          user_id: userId,
          name: name.trim(),
          teacher_name: teacher.trim() || null,
          color: selectedColor,
          created_at: new Date().toISOString(),
        }

        await personalStorage.saveSubject(newSubject)
        triggerHaptic('success')
        resetForm()
        onSubjectsUpdated()

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
            if (error) console.log('Supabase sync subject info:', error.message)
          })
      }
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
      `Se eliminará "${subjectName}" de tus materias y horarios. Las tareas vinculadas pasarán a "General".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              if (editingSubject?.id === subjectId) {
                resetForm()
              }
              await personalStorage.removeSubject(subjectId)
              onSubjectsUpdated()
              supabase.from('subjects').delete().eq('id', subjectId).then(() => {})
              supabase.from('schedules').delete().eq('subject_id', subjectId).then(() => {})
              supabase.from('tasks').update({ subject_id: null }).eq('subject_id', subjectId).then(() => {})
            } catch (err) {
              console.error('Error eliminando materia:', err)
            }
          },
        },
      ]
    )
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
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }, { translateY: panY }] },
          ]}
        >
          {/* Header con PanResponder */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.sheetTitle}>Gestionar Materias</Text>
                <Text style={styles.sheetSubtitle}>
                  {editingSubject ? 'Editando materia existente' : `${subjects.length} materias registradas`}
                </Text>
              </View>

              <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Caja de Formulario (Creación o Edición) */}
            <View style={[styles.createBox, Boolean(editingSubject) && styles.createBoxEditing]}>
              <View style={styles.boxHeaderRow}>
                <Text style={[styles.sectionHeader, Boolean(editingSubject) && styles.sectionHeaderEditing]}>
                  {editingSubject ? 'EDITAR MATERIA' : 'NUEVA MATERIA'}
                </Text>

                {Boolean(editingSubject) && (
                  <Pressable onPress={handleCancelEdit} style={styles.cancelEditBtn}>
                    <RotateCcw size={12} color="#A1A1AA" />
                    <Text style={styles.cancelEditBtnText}>Cancelar</Text>
                  </Pressable>
                )}
              </View>

              {/* Nombre de la Materia */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>NOMBRE DE LA MATERIA *</Text>
                <View style={styles.inputWrapper}>
                  <BookOpen size={15} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Ej. Cálculo Multivariable, Física..."
                    placeholderTextColor="#71717A"
                    value={name}
                    onChangeText={setName}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Profesor / Docente */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PROFESOR / DOCENTE</Text>
                <View style={styles.inputWrapper}>
                  <User size={15} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Ej. Ing. Carlos Mendoza"
                    placeholderTextColor="#71717A"
                    value={teacher}
                    onChangeText={setTeacher}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Selector de Color (8 Tonos de Alto Contraste + Blanco Puro) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>COLOR IDENTIFICADOR</Text>
                <View style={styles.colorPaletteRow}>
                  {DISTINCT_PALETTE.map((color) => {
                    const isSelected = selectedColor === color
                    const isWhite = color === '#FFFFFF'
                    return (
                      <Pressable
                        key={color}
                        onPress={() => {
                          triggerHaptic('selection')
                          setSelectedColor(color)
                        }}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          isWhite && styles.whiteColorBorder,
                          isSelected && styles.colorCircleSelected,
                        ]}
                      >
                        {isSelected && (
                          <Check
                            size={14}
                            color={isWhite ? '#09090B' : '#FFFFFF'}
                            strokeWidth={3}
                          />
                        )}
                      </Pressable>
                    )
                  })}
                </View>
              </View>

              {/* Botón Principal (Añadir o Guardar Cambios) */}
              <Pressable
                onPress={handleSaveSubject}
                disabled={loading}
                style={[styles.saveBtn, Boolean(editingSubject) && styles.saveBtnEditing]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    {editingSubject ? (
                      <>
                        <Check size={16} color="#09090B" strokeWidth={2.8} />
                        <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                      </>
                    ) : (
                      <>
                        <Plus size={16} color="#09090B" strokeWidth={2.8} />
                        <Text style={styles.saveBtnText}>Añadir Materia</Text>
                      </>
                    )}
                  </>
                )}
              </Pressable>
            </View>

            {/* Lista de Materias Registradas */}
            <View style={styles.listSection}>
              <Text style={styles.sectionHeader}>
                MATERIAS REGISTRADAS ({subjects.length})
              </Text>

              {subjects.length > 0 ? (
                <View style={styles.subjectsList}>
                  {subjects.map((s) => {
                    const isWhite = s.color === '#FFFFFF'
                    const isCurrentlyEditing = editingSubject?.id === s.id

                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleStartEdit(s)}
                        style={[
                          styles.subjectItem,
                          isCurrentlyEditing && styles.subjectItemActive,
                        ]}
                      >
                        <View style={styles.subjectItemLeft}>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: s.color || '#FFFFFF' },
                              isWhite && styles.whiteDotBorder,
                            ]}
                          />
                          <View style={styles.subjectItemTextCol}>
                            <Text style={styles.subjectName}>{s.name}</Text>
                            {Boolean(s.teacher_name) && (
                              <Text style={styles.teacherName}>{s.teacher_name}</Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.subjectItemActions}>
                          <Pressable
                            onPress={() => handleStartEdit(s)}
                            hitSlop={8}
                            style={styles.actionBtn}
                          >
                            <Pencil size={14} color={isCurrentlyEditing ? '#FFFFFF' : '#A1A1AA'} />
                          </Pressable>

                          <Pressable
                            onPress={() => handleDeleteSubject(s.id, s.name)}
                            hitSlop={8}
                            style={styles.deleteSubjBtn}
                          >
                            <Trash2 size={14} color="#EF4444" />
                          </Pressable>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptySubjsText}>
                  Aún no tienes materias registradas. Crea una arriba para asignar a tus horarios y tareas.
                </Text>
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
    backgroundColor: '#0F0F13',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: '88%',
    paddingBottom: 36,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#52525B',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  createBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  createBoxEditing: {
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  boxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionHeaderEditing: {
    color: '#FFFFFF',
  },
  cancelEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  cancelEditBtnText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteColorBorder: {
    borderWidth: 1,
    borderColor: '#71717A',
  },
  colorCircleSelected: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 44,
    borderRadius: 12,
    gap: 6,
    marginTop: 4,
  },
  saveBtnEditing: {
    backgroundColor: '#FFFFFF',
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '800',
  },
  listSection: {
    marginTop: 20,
    marginBottom: 20,
    gap: 10,
  },
  subjectsList: {
    gap: 8,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  subjectItemActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  subjectItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: '#71717A',
  },
  subjectItemTextCol: {
    flex: 1,
    gap: 2,
  },
  subjectName: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  teacherName: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  subjectItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSubjBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubjsText: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingVertical: 14,
  },
})
