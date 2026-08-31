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
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native'
import type { Task, Subject, TaskType, TaskAttachment } from '@/types/personal'
import {
  X,
  Camera,
  Image as ImageIcon,
  Link2,
  Check,
  ChevronDown,
  Paperclip,
  Trash2,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistCreateTaskModalProps {
  visible: boolean
  onClose: () => void
  userId: string
  subjects: Subject[]
  initialTask?: Task | null
  onTaskSaved: () => void
}

export function MinimalistCreateTaskModal({
  visible,
  onClose,
  userId,
  subjects = [],
  initialTask,
  onTaskSaved,
}: MinimalistCreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [taskType, setTaskType] = useState<TaskType>('individual')
  const [dueDate, setDueDate] = useState<string>('')
  const [activeDatePreset, setActiveDatePreset] = useState<'tomorrow' | 'next_class' | 'week' | null>(null)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [loading, setLoading] = useState(false)

  // Animación del modal: Backdrop con fade estático + Sheet con deslizamiento elástico
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const [modalVisible, setModalVisible] = useState(visible)

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
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
      ]).start(() => {
        setModalVisible(false)
      })
    }
  }, [visible, fadeAnim, slideAnim])

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '')
      setDescription(initialTask.description || '')
      setSelectedSubjectId(initialTask.subject_id || null)
      setTaskType(initialTask.type || 'individual')
      setDueDate(initialTask.due_date || '')
      setAttachments(Array.isArray(initialTask.attachments) ? initialTask.attachments : [])
    } else {
      setTitle('')
      setDescription('')
      setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
      setTaskType('individual')
      setDueDate('')
      setAttachments([])
      setActiveDatePreset(null)
    }
  }, [initialTask, visible, subjects])

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
    ]).start(() => {
      onClose()
    })
  }

  const setPresetDate = (preset: 'tomorrow' | 'next_class' | 'week') => {
    triggerHaptic('selection')
    setActiveDatePreset(preset)
    const now = new Date()

    if (preset === 'tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(23, 59, 0, 0)
      setDueDate(tomorrow.toISOString())
    } else if (preset === 'week') {
      const friday = new Date(now)
      const day = friday.getDay()
      const diff = (5 - day + 7) % 7 || 7
      friday.setDate(friday.getDate() + diff)
      friday.setHours(23, 59, 0, 0)
      setDueDate(friday.toISOString())
    } else if (preset === 'next_class') {
      const in2Days = new Date(now)
      in2Days.setDate(in2Days.getDate() + 2)
      in2Days.setHours(7, 0, 0, 0)
      setDueDate(in2Days.toISOString())
    }
  }

  const handlePickImage = async () => {
    triggerHaptic('light')
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se requiere acceso a tu galería para adjuntar fotos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      const newAttachment: TaskAttachment = {
        id: Math.random().toString(36).substring(7),
        file_name: asset.fileName || 'Foto de Apunte',
        file_url: asset.uri,
        file_type: 'image',
        size_bytes: asset.fileSize || 0,
      }
      setAttachments((prev) => [...prev, newAttachment])
      triggerHaptic('success')
    }
  }

  const handleTakePhoto = async () => {
    triggerHaptic('light')
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos de pizarrones.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      const newAttachment: TaskAttachment = {
        id: Math.random().toString(36).substring(7),
        file_name: 'Foto de Pizarrón',
        file_url: asset.uri,
        file_type: 'image',
        size_bytes: asset.fileSize || 0,
      }
      setAttachments((prev) => [...prev, newAttachment])
      triggerHaptic('success')
    }
  }

  const handleAddLink = () => {
    if (!linkUrl.trim()) return
    let formatted = linkUrl.trim()
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`
    }

    const newAttachment: TaskAttachment = {
      id: Math.random().toString(36).substring(7),
      file_name: linkTitle.trim() || formatted,
      file_url: formatted,
      file_type: 'link',
    }

    setAttachments((prev) => [...prev, newAttachment])
    setLinkUrl('')
    setLinkTitle('')
    setShowAddLink(false)
    triggerHaptic('success')
  }

  const handleRemoveAttachment = (id: string) => {
    triggerHaptic('light')
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa el título de la tarea.')
      return
    }

    try {
      setLoading(true)
      const selectedSubj = subjects.find((s) => s.id === selectedSubjectId)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        subject_id: selectedSubjectId || null,
        type: taskType,
        due_date: dueDate || null,
        attachments,
        status: initialTask?.status || 'pending',
        user_id: userId,
        updated_at: new Date().toISOString(),
      }

      if (initialTask?.id) {
        const fullTask: Task = {
          ...initialTask,
          ...payload,
          subject: selectedSubj,
        }
        await personalStorage.saveTask(fullTask)
        supabase.from('tasks').update(payload).eq('id', initialTask.id).then(() => {})
      } else {
        const newId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`
        const fullTask: Task = {
          id: newId,
          ...payload,
          subject: selectedSubj,
          created_at: new Date().toISOString(),
        }
        await personalStorage.saveTask(fullTask)
        supabase.from('tasks').insert({ id: newId, ...payload }).then(() => {})
      }

      triggerHaptic('success')
      onTaskSaved()
      handleSmoothClose()
    } catch (err) {
      console.error('Error al guardar tarea:', err)
      Alert.alert('Error', 'No se pudo guardar la tarea.')
    } finally {
      setLoading(false)
    }
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const isWhite = selectedSubject?.color === '#FFFFFF'

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        {/* Backdrop Estático con Fade (NO se desliza) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante */}
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>
              {initialTask ? 'Editar Tarea' : 'Nueva Tarea'}
            </Text>
            <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Título de la Tarea */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TÍTULO *</Text>
              <TextInput
                placeholder="Ej. Taller #2 de Cálculo, Ensayo..."
                placeholderTextColor="#71717A"
                value={title}
                onChangeText={setTitle}
                style={styles.textInput}
              />
            </View>

            {/* Selector de Materia */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>MATERIA</Text>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setShowSubjectPicker(!showSubjectPicker)
                }}
                style={[
                  styles.subjectPickerBtn,
                  selectedSubject && {
                    borderColor: isWhite
                      ? 'rgba(255, 255, 255, 0.4)'
                      : `${selectedSubject.color || '#FFFFFF'}60`,
                    backgroundColor: isWhite
                      ? 'rgba(255, 255, 255, 0.12)'
                      : `${selectedSubject.color || '#FFFFFF'}18`,
                  },
                ]}
              >
                {selectedSubject ? (
                  <View style={styles.selectedSubjRow}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: selectedSubject.color || '#FFFFFF' },
                        isWhite && styles.whiteDotBorder,
                      ]}
                    />
                    <Text style={styles.selectedSubjText}>{selectedSubject.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.placeholderSubjText}>Selecciona una materia...</Text>
                )}
                <ChevronDown size={14} color="#A1A1AA" />
              </Pressable>

              {/* Lista Desplegable de Materias */}
              {showSubjectPicker && (
                <View style={styles.subjectPickerDropdown}>
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection')
                      setSelectedSubjectId(null)
                      setShowSubjectPicker(false)
                    }}
                    style={[
                      styles.subjDropdownItem,
                      selectedSubjectId === null && styles.subjDropdownItemActive,
                    ]}
                  >
                    <Text style={styles.subjDropdownItemText}>General (Sin materia)</Text>
                    {selectedSubjectId === null && <Check size={14} color="#FFFFFF" />}
                  </Pressable>

                  {subjects.map((s) => {
                    const isSelected = selectedSubjectId === s.id
                    const isSubjWhite = s.color === '#FFFFFF'
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          triggerHaptic('selection')
                          setSelectedSubjectId(s.id)
                          setShowSubjectPicker(false)
                        }}
                        style={[
                          styles.subjDropdownItem,
                          isSelected && styles.subjDropdownItemActive,
                        ]}
                      >
                        <View style={styles.selectedSubjRow}>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: s.color || '#FFFFFF' },
                              isSubjWhite && styles.whiteDotBorder,
                            ]}
                          />
                          <Text style={styles.subjDropdownItemText}>{s.name}</Text>
                        </View>
                        {isSelected && <Check size={14} color={s.color || '#FFFFFF'} />}
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </View>

            {/* Tipo de Tarea (Segmented Control Muted) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TIPO DE ENTREGA</Text>
              <View style={styles.typeRow}>
                {(['individual', 'grupal', 'proyecto', 'examen'] as TaskType[]).map((t) => {
                  const isSelected = taskType === t
                  return (
                    <Pressable
                      key={t}
                      onPress={() => {
                        triggerHaptic('selection')
                        setTaskType(t)
                      }}
                      style={[
                        styles.typePill,
                        isSelected && styles.typePillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          isSelected && styles.typePillTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Fecha Límite Rápida */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FECHA LÍMITE RÁPIDA</Text>
              <View style={styles.presetRow}>
                <Pressable
                  onPress={() => setPresetDate('tomorrow')}
                  style={[
                    styles.presetPill,
                    activeDatePreset === 'tomorrow' && styles.presetPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      activeDatePreset === 'tomorrow' && styles.presetTextActive,
                    ]}
                  >
                    Mañana 11:59 PM
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPresetDate('week')}
                  style={[
                    styles.presetPill,
                    activeDatePreset === 'week' && styles.presetPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      activeDatePreset === 'week' && styles.presetTextActive,
                    ]}
                  >
                    Viernes
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPresetDate('next_class')}
                  style={[
                    styles.presetPill,
                    activeDatePreset === 'next_class' && styles.presetPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      activeDatePreset === 'next_class' && styles.presetTextActive,
                    ]}
                  >
                    En 2 días
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Descripción / Notas */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>NOTAS / INSTRUCCIONES</Text>
              <TextInput
                placeholder="Detalles, páginas del libro, observaciones..."
                placeholderTextColor="#71717A"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={[styles.textInput, styles.textArea]}
              />
            </View>

            {/* Fotos y Adjuntos */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ADJUNTOS Y FOTOS DE PIZARRÓN</Text>
              <View style={styles.attachmentButtonsRow}>
                <Pressable onPress={handleTakePhoto} style={styles.attBtn}>
                  <Camera size={14} color="#FFFFFF" />
                  <Text style={styles.attBtnText}>Foto</Text>
                </Pressable>

                <Pressable onPress={handlePickImage} style={styles.attBtn}>
                  <ImageIcon size={14} color="#FFFFFF" />
                  <Text style={styles.attBtnText}>Galería</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    setShowAddLink(!showAddLink)
                  }}
                  style={styles.attBtn}
                >
                  <Link2 size={14} color="#FFFFFF" />
                  <Text style={styles.attBtnText}>Enlace</Text>
                </Pressable>
              </View>

              {/* Formulario de Enlace */}
              {showAddLink && (
                <View style={styles.linkForm}>
                  <TextInput
                    placeholder="URL (ej: drive.google.com/...)"
                    placeholderTextColor="#71717A"
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    style={styles.linkInput}
                  />
                  <TextInput
                    placeholder="Nombre del enlace (opcional)"
                    placeholderTextColor="#71717A"
                    value={linkTitle}
                    onChangeText={setLinkTitle}
                    style={styles.linkInput}
                  />
                  <Pressable onPress={handleAddLink} style={styles.linkAddBtn}>
                    <Text style={styles.linkAddBtnText}>Agregar Enlace</Text>
                  </Pressable>
                </View>
              )}

              {/* Lista de Adjuntos Cargados */}
              {attachments.length > 0 && (
                <View style={styles.attachmentsList}>
                  {attachments.map((a) => (
                    <View key={a.id} style={styles.attachmentItem}>
                      <Paperclip size={13} color="#A1A1AA" />
                      <Text style={styles.attachmentItemText} numberOfLines={1}>
                        {a.file_name}
                      </Text>
                      <Pressable
                        onPress={() => handleRemoveAttachment(a.id)}
                        hitSlop={8}
                      >
                        <Trash2 size={13} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Botón Guardar Principal */}
            <Pressable
              onPress={handleSave}
              disabled={loading}
              style={styles.saveBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {initialTask ? 'Guardar Cambios' : 'Crear Tarea'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
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
    maxHeight: '90%',
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
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  subjectPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedSubjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedSubjText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  placeholderSubjText: {
    color: '#71717A',
    fontSize: 13.5,
  },
  subjectPickerDropdown: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 6,
    padding: 6,
    gap: 4,
  },
  subjDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  subjDropdownItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  subjDropdownItemText: {
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
  typeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typePill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  typePillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  typePillText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  presetText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#FDE68A',
    fontWeight: '700',
  },
  attachmentButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    paddingVertical: 10,
  },
  attBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  linkForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  linkInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
  },
  linkAddBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentsList: {
    marginTop: 8,
    gap: 6,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  attachmentItemText: {
    color: '#D4D4D8',
    fontSize: 12,
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
})
