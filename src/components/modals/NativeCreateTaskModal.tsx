import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import type { Task, Subject, TaskType, TaskAttachment } from '@/types/database'
import {
  X,
  Plus,
  Calendar,
  BookOpen,
  User,
  Users,
  Rocket,
  FileText,
  Lock,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Link2,
  Check,
  ChevronDown,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { triggerHaptic } from '@/lib/nativeHaptics'
import { supabase } from '@/lib/nativeSupabase'

interface NativeCreateTaskModalProps {
  visible: boolean
  onClose: () => void
  classroomId: string
  currentUserId: string
  isAdmin?: boolean
  subjects: Subject[]
  initialTask?: Task | null
  onTaskSaved?: () => void
}

export function NativeCreateTaskModal({
  visible,
  onClose,
  classroomId,
  currentUserId,
  isAdmin,
  subjects = [],
  initialTask,
  onTaskSaved,
}: NativeCreateTaskModalProps) {
  const [scope, setScope] = useState<'classroom' | 'private'>('classroom')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [taskType, setTaskType] = useState<TaskType>('individual')
  const [dueDate, setDueDate] = useState<string>('')
  const [activeDatePreset, setActiveDatePreset] = useState<'tomorrow' | 'next_class' | 'week' | 'custom' | null>(null)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showAddLinkInput, setShowAddLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '')
      setDescription(initialTask.description || '')
      setSelectedSubjectId(initialTask.subject_id || null)
      setTaskType(initialTask.type || 'individual')
      setScope(initialTask.is_private ? 'private' : 'classroom')
      setDueDate(initialTask.due_date || '')
      setAttachments(Array.isArray(initialTask.attachments) ? initialTask.attachments : [])
    } else {
      setTitle('')
      setDescription('')
      setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
      setTaskType('individual')
      setScope(isAdmin ? 'classroom' : 'private')
      setAttachments([])
      setDueDate('')
      setActiveDatePreset(null)
    }
  }, [initialTask, visible, subjects, isAdmin])

  const setPresetDate = (preset: 'tomorrow' | 'next_class' | 'week') => {
    triggerHaptic('light')
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
      Alert.alert('Permiso requerido', 'Se requiere acceso a tu galería para adjuntar imágenes.')
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
        file_name: asset.fileName || 'Foto adjunta',
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
        file_name: 'Foto de cámara',
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
    triggerHaptic('success')
    const newAttachment: TaskAttachment = {
      id: Math.random().toString(36).substring(7),
      file_name: linkTitle.trim() || linkUrl.trim(),
      file_url: linkUrl.trim(),
      file_type: 'link',
    }
    setAttachments((prev) => [...prev, newAttachment])
    setLinkUrl('')
    setLinkTitle('')
    setShowAddLinkInput(false)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Campo obligatorio', 'Por favor ingresa un título para la tarea.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    try {
      const taskPayload = {
        classroom_id: classroomId,
        created_by: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
        subject_id: selectedSubjectId || null,
        type: taskType,
        is_private: scope === 'private',
        due_date: dueDate || null,
        attachments: attachments,
        updated_at: new Date().toISOString(),
      }

      if (initialTask) {
        const { error } = await supabase
          .from('tasks')
          .update(taskPayload)
          .eq('id', initialTask.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert(taskPayload)

        if (error) throw error
      }

      triggerHaptic('success')
      onTaskSaved?.()
      onClose()
    } catch (err: any) {
      console.error('Error guardando tarea:', err)
      Alert.alert('Error', err.message || 'No se pudo guardar la tarea.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>
              {initialTask ? 'Editar Tarea' : scope === 'classroom' ? 'Nueva Tarea del Salón' : 'Nuevo Pendiente Personal'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Selector de Ámbito (Salón vs Privada) */}
            {!initialTask && isAdmin && (
              <View style={styles.scopeSelector}>
                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    setScope('classroom')
                  }}
                  style={[styles.scopeBtn, scope === 'classroom' && styles.scopeBtnActive]}
                >
                  <Users size={13} color={scope === 'classroom' ? '#09090B' : '#71717A'} />
                  <Text style={[styles.scopeBtnText, scope === 'classroom' && styles.scopeBtnTextActive]}>
                    Del Salón (Oficial)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    setScope('private')
                  }}
                  style={[styles.scopeBtn, scope === 'private' && styles.scopeBtnActive]}
                >
                  <Lock size={13} color={scope === 'private' ? '#09090B' : '#71717A'} />
                  <Text style={[styles.scopeBtnText, scope === 'private' && styles.scopeBtnTextActive]}>
                    Mis Pendientes (Privado)
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Input Título */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TÍTULO DE LA TAREA *</Text>
              <TextInput
                placeholder="Ej. Taller de Algoritmos o Ensayo"
                placeholderTextColor="#52525B"
                value={title}
                onChangeText={setTitle}
                style={styles.textInput}
              />
            </View>

            {/* Selector de Materia */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MATERIA</Text>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setShowSubjectPicker(!showSubjectPicker)
                }}
                style={styles.subjectSelector}
              >
                {selectedSubject ? (
                  <View style={styles.selectedSubjectRow}>
                    <View style={[styles.dot, { backgroundColor: selectedSubject.color || '#6366F1' }]} />
                    <Text style={styles.selectedSubjectText}>{selectedSubject.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.noSubjectText}>Selecciona una materia o General</Text>
                )}
                <ChevronDown size={16} color="#71717A" />
              </Pressable>

              {/* Lista Desplegable de Materias */}
              {showSubjectPicker && (
                <View style={styles.subjectDropdown}>
                  <Pressable
                    onPress={() => {
                      triggerHaptic('light')
                      setSelectedSubjectId(null)
                      setShowSubjectPicker(false)
                    }}
                    style={styles.subjectOption}
                  >
                    <Text style={styles.subjectOptionText}>General (Sin Materia)</Text>
                  </Pressable>
                  {subjects.map((subj) => (
                    <Pressable
                      key={subj.id}
                      onPress={() => {
                        triggerHaptic('light')
                        setSelectedSubjectId(subj.id)
                        setShowSubjectPicker(false)
                      }}
                      style={styles.subjectOption}
                    >
                      <View style={[styles.dot, { backgroundColor: subj.color || '#6366F1' }]} />
                      <Text style={styles.subjectOptionText}>{subj.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Tipo de Tarea */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TIPO DE ENTREGA</Text>
              <View style={styles.typeSelector}>
                {(['individual', 'grupal', 'proyecto', 'examen'] as TaskType[]).map((t) => {
                  const isSelected = taskType === t
                  return (
                    <Pressable
                      key={t}
                      onPress={() => {
                        triggerHaptic('light')
                        setTaskType(t)
                      }}
                      style={[styles.typeBtn, isSelected && styles.typeBtnActive]}
                    >
                      <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextActive]}>
                        {t === 'individual' ? 'Individual' : t === 'grupal' ? 'Grupal' : t === 'proyecto' ? 'Proyecto' : 'Examen'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Presets Inteligentes de Fecha Límite */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FECHA LÍMITE RÁPIDA</Text>
              <View style={styles.presetsRow}>
                <Pressable
                  onPress={() => setPresetDate('tomorrow')}
                  style={[styles.presetBtn, activeDatePreset === 'tomorrow' && styles.presetBtnActive]}
                >
                  <Text style={[styles.presetBtnText, activeDatePreset === 'tomorrow' && styles.presetBtnTextActive]}>
                    Mañana 11:59 PM
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPresetDate('next_class')}
                  style={[styles.presetBtn, activeDatePreset === 'next_class' && styles.presetBtnActive]}
                >
                  <Text style={[styles.presetBtnText, activeDatePreset === 'next_class' && styles.presetBtnTextActive]}>
                    Próxima Clase
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPresetDate('week')}
                  style={[styles.presetBtn, activeDatePreset === 'week' && styles.presetBtnActive]}
                >
                  <Text style={[styles.presetBtnText, activeDatePreset === 'week' && styles.presetBtnTextActive]}>
                    Fin de Semana
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Descripción / Notas */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DESCRIPCIÓN / INSTRUCCIONES</Text>
              <TextInput
                placeholder="Detalles, enlaces, instrucciones o criterios..."
                placeholderTextColor="#52525B"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={[styles.textInput, styles.textArea]}
              />
            </View>

            {/* Archivos y Fotos Adjuntas */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ADJUNTOS ({attachments.length})</Text>
              <View style={styles.attachmentButtonsRow}>
                <Pressable onPress={handlePickImage} style={styles.addAttachBtn}>
                  <ImageIcon size={14} color="#818CF8" />
                  <Text style={styles.addAttachBtnText}>Galería</Text>
                </Pressable>
                <Pressable onPress={handleTakePhoto} style={styles.addAttachBtn}>
                  <Camera size={14} color="#818CF8" />
                  <Text style={styles.addAttachBtnText}>Cámara</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowAddLinkInput(!showAddLinkInput)}
                  style={styles.addAttachBtn}
                >
                  <Link2 size={14} color="#818CF8" />
                  <Text style={styles.addAttachBtnText}>Enlace Web</Text>
                </Pressable>
              </View>

              {/* Input para agregar enlace web */}
              {showAddLinkInput && (
                <View style={styles.linkInputBox}>
                  <TextInput
                    placeholder="https://drive.google.com/... o enlace"
                    placeholderTextColor="#52525B"
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    style={styles.textInput}
                    autoCapitalize="none"
                  />
                  <TextInput
                    placeholder="Nombre del enlace (opcional)"
                    placeholderTextColor="#52525B"
                    value={linkTitle}
                    onChangeText={setLinkTitle}
                    style={[styles.textInput, { marginTop: 6 }]}
                  />
                  <Pressable onPress={handleAddLink} style={styles.saveLinkBtn}>
                    <Text style={styles.saveLinkBtnText}>Agregar Enlace</Text>
                  </Pressable>
                </View>
              )}

              {/* Lista de adjuntos agregados */}
              {attachments.map((att, idx) => (
                <View key={idx} style={styles.attachmentItem}>
                  <Paperclip size={13} color="#818CF8" />
                  <Text style={styles.attachmentItemName} numberOfLines={1}>
                    {att.file_name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      triggerHaptic('light')
                      setAttachments(attachments.filter((_, i) => i !== idx))
                    }}
                    hitSlop={8}
                  >
                    <X size={14} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Botón Guardar / Publicar */}
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
                  <Text style={styles.saveBtnText}>
                    {initialTask ? 'Guardar Cambios' : scope === 'classroom' ? 'Publicar Tarea Oficial' : 'Guardar Pendiente'}
                  </Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  scopeSelector: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
  },
  scopeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  scopeBtnText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  scopeBtnTextActive: {
    color: '#09090B',
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13.5,
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  subjectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectedSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectedSubjectText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  noSubjectText: {
    color: '#71717A',
    fontSize: 13,
  },
  subjectDropdown: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 4,
    overflow: 'hidden',
  },
  subjectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  subjectOptionText: {
    color: '#E4E4E7',
    fontSize: 13,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  typeBtnActive: {
    backgroundColor: '#27272A',
    borderColor: '#52525B',
  },
  typeBtnText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#818CF8',
  },
  presetBtnText: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  presetBtnTextActive: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  attachmentButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addAttachBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#18181B',
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  addAttachBtnText: {
    color: '#D4D4D8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  linkInputBox: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 6,
  },
  saveLinkBtn: {
    backgroundColor: '#27272A',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    marginTop: 8,
  },
  saveLinkBtnText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 6,
    gap: 8,
  },
  attachmentItemName: {
    color: '#FFFFFF',
    fontSize: 12,
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
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
    fontSize: 14,
    fontWeight: '800',
  },
})
