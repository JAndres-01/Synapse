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
  Image,
} from 'react-native'
import type { Task, Subject, TaskType, TaskAttachment } from '@/types/personal'
import {
  X,
  Camera,
  Image as ImageIcon,
  Link2,
  Check,
  ChevronDown,
  Calendar,
  Layers,
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
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])

  // Menús desplegables minimalistas
  const [activePicker, setActivePicker] = useState<'subject' | 'type' | 'date' | 'link' | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // Animaciones del modal
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
    }
    setActivePicker(null)
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

  const setPresetDate = (preset: 'today' | 'tomorrow' | 'friday' | 'next_week' | 'clear') => {
    triggerHaptic('selection')
    const now = new Date()

    if (preset === 'clear') {
      setDueDate('')
      setActivePicker(null)
      return
    }

    if (preset === 'today') {
      now.setHours(23, 59, 0, 0)
      setDueDate(now.toISOString())
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(23, 59, 0, 0)
      setDueDate(tomorrow.toISOString())
    } else if (preset === 'friday') {
      const friday = new Date(now)
      const day = friday.getDay()
      const diff = (5 - day + 7) % 7 || 7
      friday.setDate(friday.getDate() + diff)
      friday.setHours(23, 59, 0, 0)
      setDueDate(friday.toISOString())
    } else if (preset === 'next_week') {
      const nextWeek = new Date(now)
      nextWeek.setDate(nextWeek.getDate() + 7)
      nextWeek.setHours(23, 59, 0, 0)
      setDueDate(nextWeek.toISOString())
    }
    setActivePicker(null)
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
      Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos.')
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
      file_name: formatted.replace(/^https?:\/\/(www\.)?/, '').slice(0, 24),
      file_url: formatted,
      file_type: 'link',
    }

    setAttachments((prev) => [...prev, newAttachment])
    setLinkUrl('')
    setActivePicker(null)
    triggerHaptic('success')
  }

  const handleRemoveAttachment = (id: string) => {
    triggerHaptic('light')
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Título requerido', 'Por favor escribe el nombre de la tarea.')
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

  const formatDueDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'Sin fecha'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return 'Sin fecha'
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isTomorrow = d.toDateString() === tomorrow.toDateString()

      if (isToday) return 'Hoy'
      if (isTomorrow) return 'Mañana'
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return `${days[d.getDay()]} ${d.getDate()}`
    } catch {
      return 'Sin fecha'
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
        {/* Backdrop Estático con Fade */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Ultra-Minimalista */}
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header Minimalista */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>

              <Text style={styles.sheetTitle}>
                {initialTask ? 'Editar Tarea' : 'Nueva Tarea'}
              </Text>

              <Pressable
                onPress={handleSave}
                disabled={loading}
                hitSlop={12}
                style={styles.saveHeaderBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveHeaderBtnText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Input de Título Grande y Limpio (Sin recuadro tosco) */}
            <TextInput
              placeholder="¿Qué tienes que hacer?"
              placeholderTextColor="#52525B"
              value={title}
              onChangeText={setTitle}
              style={styles.cleanTitleInput}
              autoFocus={!initialTask}
            />

            {/* Input de Descripción Limpio */}
            <TextInput
              placeholder="Añadir notas, detalles o páginas..."
              placeholderTextColor="#52525B"
              value={description}
              onChangeText={setDescription}
              multiline
              style={styles.cleanDescInput}
            />

            {/* Barra de Atributos Rápidos (Cápsulas Horizontales Minimalistas) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attributeBar}
            >
              {/* Selector de Materia */}
              <Pressable
                onPress={() => {
                  triggerHaptic('selection')
                  setActivePicker(activePicker === 'subject' ? null : 'subject')
                }}
                style={[
                  styles.attrPill,
                  selectedSubject && {
                    backgroundColor: isWhite
                      ? 'rgba(255, 255, 255, 0.15)'
                      : `${selectedSubject.color || '#FFFFFF'}22`,
                    borderColor: isWhite
                      ? 'rgba(255, 255, 255, 0.4)'
                      : `${selectedSubject.color || '#FFFFFF'}60`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: selectedSubject?.color || '#71717A' },
                    isWhite && styles.whiteDotBorder,
                  ]}
                />
                <Text style={styles.attrPillText}>
                  {selectedSubject ? selectedSubject.name : 'Materia'}
                </Text>
                <ChevronDown size={12} color="#71717A" />
              </Pressable>

              {/* Selector de Fecha */}
              <Pressable
                onPress={() => {
                  triggerHaptic('selection')
                  setActivePicker(activePicker === 'date' ? null : 'date')
                }}
                style={[
                  styles.attrPill,
                  Boolean(dueDate) && styles.attrPillActive,
                ]}
              >
                <Calendar size={13} color={dueDate ? '#FFFFFF' : '#71717A'} />
                <Text
                  style={[
                    styles.attrPillText,
                    Boolean(dueDate) && styles.attrPillTextActive,
                  ]}
                >
                  {formatDueDateLabel(dueDate)}
                </Text>
                <ChevronDown size={12} color="#71717A" />
              </Pressable>

              {/* Selector de Tipo */}
              <Pressable
                onPress={() => {
                  triggerHaptic('selection')
                  setActivePicker(activePicker === 'type' ? null : 'type')
                }}
                style={[
                  styles.attrPill,
                  taskType !== 'individual' && styles.attrPillActive,
                ]}
              >
                <Layers size={13} color={taskType !== 'individual' ? '#FFFFFF' : '#71717A'} />
                <Text
                  style={[
                    styles.attrPillText,
                    taskType !== 'individual' && styles.attrPillTextActive,
                  ]}
                >
                  {taskType}
                </Text>
                <ChevronDown size={12} color="#71717A" />
              </Pressable>

              {/* Foto Cámara */}
              <Pressable onPress={handleTakePhoto} style={styles.attrIconPill}>
                <Camera size={15} color="#A1A1AA" />
              </Pressable>

              {/* Galería */}
              <Pressable onPress={handlePickImage} style={styles.attrIconPill}>
                <ImageIcon size={15} color="#A1A1AA" />
              </Pressable>

              {/* Enlace */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setActivePicker(activePicker === 'link' ? null : 'link')
                }}
                style={styles.attrIconPill}
              >
                <Link2 size={15} color="#A1A1AA" />
              </Pressable>
            </ScrollView>

            {/* Menús Desplegables de Selección Rápida */}
            {activePicker === 'subject' && (
              <View style={styles.inlineMenu}>
                <Text style={styles.inlineMenuHeader}>Elegir materia</Text>
                <Pressable
                  onPress={() => {
                    triggerHaptic('selection')
                    setSelectedSubjectId(null)
                    setActivePicker(null)
                  }}
                  style={[
                    styles.inlineMenuItem,
                    selectedSubjectId === null && styles.inlineMenuItemActive,
                  ]}
                >
                  <Text style={styles.inlineMenuItemText}>General (Sin materia)</Text>
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
                        setActivePicker(null)
                      }}
                      style={[
                        styles.inlineMenuItem,
                        isSelected && styles.inlineMenuItemActive,
                      ]}
                    >
                      <View style={styles.inlineMenuLeft}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: s.color || '#FFFFFF' },
                            isSubjWhite && styles.whiteDotBorder,
                          ]}
                        />
                        <Text style={styles.inlineMenuItemText}>{s.name}</Text>
                      </View>
                      {isSelected && <Check size={14} color={s.color || '#FFFFFF'} />}
                    </Pressable>
                  )
                })}
              </View>
            )}

            {activePicker === 'date' && (
              <View style={styles.inlineMenu}>
                <Text style={styles.inlineMenuHeader}>Fecha de entrega</Text>
                <View style={styles.dateOptionsRow}>
                  <Pressable onPress={() => setPresetDate('today')} style={styles.dateOptionBtn}>
                    <Text style={styles.dateOptionText}>Hoy</Text>
                  </Pressable>
                  <Pressable onPress={() => setPresetDate('tomorrow')} style={styles.dateOptionBtn}>
                    <Text style={styles.dateOptionText}>Mañana</Text>
                  </Pressable>
                  <Pressable onPress={() => setPresetDate('friday')} style={styles.dateOptionBtn}>
                    <Text style={styles.dateOptionText}>Viernes</Text>
                  </Pressable>
                  <Pressable onPress={() => setPresetDate('next_week')} style={styles.dateOptionBtn}>
                    <Text style={styles.dateOptionText}>7 días</Text>
                  </Pressable>
                  {Boolean(dueDate) && (
                    <Pressable onPress={() => setPresetDate('clear')} style={styles.dateOptionClearBtn}>
                      <Text style={styles.dateOptionClearText}>Quitar</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {activePicker === 'type' && (
              <View style={styles.inlineMenu}>
                <Text style={styles.inlineMenuHeader}>Tipo de tarea</Text>
                <View style={styles.typeOptionsRow}>
                  {(['individual', 'grupal', 'proyecto', 'examen'] as TaskType[]).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        triggerHaptic('selection')
                        setTaskType(t)
                        setActivePicker(null)
                      }}
                      style={[
                        styles.typeOptionBtn,
                        taskType === t && styles.typeOptionBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          taskType === t && styles.typeOptionTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {activePicker === 'link' && (
              <View style={styles.inlineMenu}>
                <Text style={styles.inlineMenuHeader}>Pegar enlace web o Drive</Text>
                <View style={styles.linkRow}>
                  <TextInput
                    placeholder="https://..."
                    placeholderTextColor="#71717A"
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    style={styles.cleanLinkInput}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={handleAddLink} style={styles.linkConfirmBtn}>
                    <Text style={styles.linkConfirmBtnText}>Añadir</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Adjuntos Cargados (Píldoras Delicadas) */}
            {attachments.length > 0 && (
              <View style={styles.attachmentsSection}>
                {attachments.map((a) => (
                  <View key={a.id} style={styles.attachedPill}>
                    <Paperclip size={12} color="#A1A1AA" />
                    <Text style={styles.attachedPillText} numberOfLines={1}>
                      {a.file_name}
                    </Text>
                    <Pressable onPress={() => handleRemoveAttachment(a.id)} hitSlop={10}>
                      <X size={12} color="#71717A" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
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
    maxHeight: '85%',
    paddingBottom: 34,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 18,
  },
  cancelBtn: {
    paddingVertical: 4,
  },
  cancelBtnText: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  saveHeaderBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  saveHeaderBtnText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '800',
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  cleanTitleInput: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 8,
    letterSpacing: -0.4,
  },
  cleanDescInput: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
    minHeight: 60,
  },
  attributeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  attrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  attrPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  attrPillText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  attrPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  attrIconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  inlineMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    gap: 6,
  },
  inlineMenuHeader: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inlineMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  inlineMenuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inlineMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineMenuItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dateOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dateOptionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  dateOptionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dateOptionClearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  dateOptionClearText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },
  typeOptionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeOptionBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  typeOptionText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeOptionTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cleanLinkInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
  },
  linkConfirmBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkConfirmBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  attachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  attachedPillText: {
    color: '#D4D4D8',
    fontSize: 11.5,
    maxWidth: 160,
  },
})
