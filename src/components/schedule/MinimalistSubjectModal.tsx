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
import { X, Plus, Trash2, BookOpen, Check, User } from 'lucide-react-native'
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
  '#3B82F6', // Azul ElÃ©ctrico
  '#10B981', // Verde Esmeralda
  '#EF4444', // Rojo Brillante
  '#F59E0B', // Amarillo Ãmbar
  '#8B5CF6', // Morado ElÃ©ctrico
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
      await personalStorage.saveSubject(newSubject)
      triggerHaptic('success')
      setName('')
      setTeacher('')
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
      'Â¿Eliminar materia?',
      `Se eliminarÃ¡ "${subjectName}" de tus materias y horarios.`,
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

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop EstÃ¡tico */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante */}
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }, { translateY: panY }] }]}>
          {/* Header */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>Gestionar Materias</Text>
            <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Formulario de CreaciÃ³n Simplificado (3 Campos: Nombre, Profesor, Color) */}
            <View style={styles.createBox}>
              <Text style={styles.sectionHeader}>NUEVA MATERIA</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>NOMBRE DE LA MATERIA *</Text>
                <View style={styles.inputWrapper}>
                  <BookOpen size={15} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Ej. CÃ¡lculo Multivariable, FÃ­sica..."
                    placeholderTextColor="#71717A"
                    value={name}
                    onChangeText={setName}
                    style={styles.textInput}
                  />
                </View>
              </View>

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

              {/* BotÃ³n de Agregar */}
              <Pressable
                onPress={handleCreateSubject}
                disabled={loading}
                style={styles.addBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <Plus size={16} color="#09090B" strokeWidth={2.8} />
                    <Text style={styles.addBtnText}>AÃ±adir Materia</Text>
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
                    return (
                      <View key={s.id} style={styles.subjectItem}>
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
                            {s.teacher_name && (
                              <Text style={styles.teacherName}>{s.teacher_name}</Text>
                            )}
                          </View>
                        </View>

                        <Pressable
                          onPress={() => handleDeleteSubject(s.id, s.name)}
                          hitSlop={10}
                          style={styles.deleteSubjBtn}
                        >
                          <Trash2 size={15} color="#EF4444" />
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptySubjsText}>
                  AÃºn no tienes materias registradas. Crea una arriba para asignar a tus horarios y tareas.
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
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
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
  createBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  inputGroup: {
    gap: 5,
  },
  label: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    paddingVertical: 10,
  },
  colorPaletteRow: {
    flexDirection: 'row',
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
    borderWidth: 1.5,
    borderColor: '#71717A',
  },
  colorCircleSelected: {
    transform: [{ scale: 1.15 }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 4,
  },
  addBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '800',
  },
  listSection: {
    marginTop: 20,
    gap: 10,
  },
  subjectsList: {
    gap: 6,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  subjectItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  subjectItemTextCol: {
    flex: 1,
    gap: 1,
  },
  subjectName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  teacherName: {
    color: '#71717A',
    fontSize: 11.5,
  },
  deleteSubjBtn: {
    padding: 6,
  },
  emptySubjsText: {
    color: '#71717A',
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 6,
  },
})
