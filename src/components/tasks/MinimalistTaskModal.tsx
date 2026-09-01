import React, { useState, useEffect, useRef } from 'react'
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
  Platform,
  Animated,
  Dimensions,
  Keyboard,
  Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Subject, TaskType, TaskAttachment } from '@/types/personal'
import {
  X,
  Clock,
  Trash2,
  Edit2,
  Check,
  Paperclip,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  Link2,
  ChevronDown,
  Calendar,
  Layers,
  ArrowLeft,
  Maximize2,
  Rocket,
  FileText,
  Users,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export type TaskModalMode = 'none' | 'detail' | 'create' | 'edit'

const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)

interface MinimalistTaskModalProps {
  mode: TaskModalMode
  task: Task | null
  userId: string
  subjects: Subject[]
  onClose: () => void
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onDeleteTask: (taskId: string) => Promise<void>
  onTaskSaved: () => void
}

export function MinimalistTaskModal({
  mode,
  task,
  userId,
  subjects = [],
  onClose,
  onToggleStatus,
  onDeleteTask,
  onTaskSaved,
}: MinimalistTaskModalProps) {
  const insets = useSafeAreaInsets()
  const [currentView, setCurrentView] = useState<'detail' | 'form'>('detail')
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [taskType, setTaskType] = useState<TaskType>('individual')
  const [dueDate, setDueDate] = useState<string>('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])

  const titleInputRef = useRef<TextInput>(null)

  // Menús desplegables en formulario
  const [activePicker, setActivePicker] = useState<'subject' | 'type' | 'date' | 'link' | null>(null)
  const [linkUrl, setLinkUrl] = useState('')

  // Animaciones del Modal y Teclado 100% en GPU Driver Nativo (translateY)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)

  // Sincronización con el teclado de iOS (solo cuando el modal está activo)
  useEffect(() => {
    if (!modalVisible) return

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates.height
      const duration = e.duration && e.duration > 0 ? e.duration : 220
      const targetOffset = -Math.max(0, kbHeight - insets.bottom)

      Animated.timing(keyboardTranslateY, {
        toValue: targetOffset,
        duration: duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 200

      Animated.timing(keyboardTranslateY, {
        toValue: 0,
        duration: duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [modalVisible, insets.bottom, keyboardTranslateY])

  // Apertura y Cierre controlados de forma estrictamente estable
  useEffect(() => {
    if (mode !== 'none') {
      setModalVisible(true)
      setCurrentView(mode === 'detail' ? 'detail' : 'form')

      if (mode === 'create') {
        setTitle('')
        setDescription('')
        setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
        setTaskType('individual')
        setDueDate('')
        setAttachments([])
      } else if (task && (mode === 'edit' || mode === 'detail')) {
        setTitle(task.title || '')
        setDescription(task.description || '')
        setSelectedSubjectId(task.subject_id || null)
        setTaskType(task.type || 'individual')
        setDueDate(task.due_date || '')
        setAttachments(Array.isArray(task.attachments) ? task.attachments : [])
      }
      setActivePicker(null)

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start()

      if (mode === 'create') {
        requestAnimationFrame(() => {
          titleInputRef.current?.focus()
        })
      }
    } else {
      Keyboard.dismiss()
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(keyboardTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
      })
    }
  }, [mode, task?.id])

  const handleSmoothClose = () => {
    triggerHaptic('light')
    Keyboard.dismiss()
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(keyboardTranslateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose()
    })
  }

  const isCompleted = task?.status === 'completed'

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return { text: '', isOverdue: false, isToday: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: '', isOverdue: false, isToday: false }
      const now = new Date()
      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()

      const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

      const dayName = daysOfWeek[date.getDay()]
      const dayNum = date.getDate()
      const monthName = months[date.getMonth()]
      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isToday) {
        return { text: `Hoy a las ${timeStr}`, isOverdue: false, isToday: true }
      }
      if (isPast && !isCompleted) {
        return { text: `Venció el ${dayName} ${dayNum} de ${monthName}`, isOverdue: true, isToday: false }
      }
      return { text: `${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
    } catch {
      return { text: '', isOverdue: false, isToday: false }
    }
  }

  const dueInfo = formatDueDate(task?.due_date)
  const detailAttachments = Array.isArray(task?.attachments) ? task.attachments : []

  const handleDelete = () => {
    if (!task) return
    Keyboard.dismiss()
    Alert.alert(
      '¿Eliminar esta tarea?',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              setDeleteLoading(true)
              await onDeleteTask?.(task.id)
              handleSmoothClose()
            } catch (err) {
              console.error('Error eliminando:', err)
            } finally {
              setDeleteLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleSwitchToEdit = () => {
    triggerHaptic('light')
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setSelectedSubjectId(task.subject_id || null)
      setTaskType(task.type || 'individual')
      setDueDate(task.due_date || '')
      setAttachments(Array.isArray(task.attachments) ? task.attachments : [])
    }
    setCurrentView('form')
    requestAnimationFrame(() => {
      titleInputRef.current?.focus()
    })
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Título requerido', 'Por favor escribe el nombre de la tarea.')
      return
    }

    try {
      Keyboard.dismiss()
      setSaveLoading(true)
      const selectedSubj = subjects.find((s) => s.id === selectedSubjectId)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        subject_id: selectedSubjectId || null,
        type: taskType,
        due_date: dueDate || null,
        attachments,
        status: task?.status || 'pending',
        user_id: userId,
        updated_at: new Date().toISOString(),
      }

      if (task?.id && (mode === 'edit' || currentView === 'form')) {
        const fullTask: Task = {
          ...task,
          ...payload,
          subject: selectedSubj,
        }
        await personalStorage.saveTask(fullTask)
        supabase.from('tasks').update(payload).eq('id', task.id).then(() => {})
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
      setSaveLoading(false)
    }
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
    Keyboard.dismiss()
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
    Keyboard.dismiss()
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
  const isFormSubjWhite = selectedSubject?.color === '#FFFFFF'

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop Estático con Fade (useNativeDriver: true) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante (useNativeDriver: true 100% GPU) */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 16,
              transform: [
                { translateY: slideAnim },
                { translateY: keyboardTranslateY },
              ],
            },
          ]}
        >
          {/* ========================================================================= */}
          {/* VISTA: DETALLE ESTILIZADO CON SIMETRÍA Y ALINEACIÓN PERFECTA              */}
          {/* ========================================================================= */}
          {currentView === 'detail' && (
            <>
              {/* Header con Drag Handle y Botón de Editar Estilizado */}
              <View style={styles.detailHeaderBar}>
                <View style={styles.dragHandle} />
                <View style={styles.detailHeaderActions}>
                  <Pressable
                    onPress={handleSwitchToEdit}
                    hitSlop={12}
                    style={styles.detailEditBtn}
                  >
                    <Edit2 size={12} color="#FFFFFF" />
                    <Text style={styles.detailEditBtnText}>Editar</Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. TÍTULO DE LA TAREA (PROTAGONISTA Y ALINEADO AL BORDE IZQUIERDO) */}
                <Text style={styles.detailHeroTitle}>
                  {task?.title}
                </Text>

                {/* 2. NOTAS / DETALLES (TEXTO DIRECTO FLUIDO ALINEADO AL BORDE IZQUIERDO) */}
                {Boolean(task?.description) && (
                  <Text style={styles.detailDescriptionText}>
                    {task?.description}
                  </Text>
                )}

                {/* 3. FECHA DE ENTREGA (DIRECTA, SIN CARD, ALINEADA AL BORDE IZQUIERDO) */}
                {Boolean(dueInfo.text) && (
                  <View style={styles.detailDateRow}>
                    <Clock
                      size={13}
                      color={
                        isCompleted
                          ? '#34D399'
                          : dueInfo.isOverdue
                          ? '#F87171'
                          : dueInfo.isToday
                          ? '#818CF8'
                          : '#A1A1AA'
                      }
                    />
                    <Text
                      style={[
                        styles.detailDateText,
                        dueInfo.isToday && styles.detailDateTextToday,
                        dueInfo.isOverdue && styles.detailDateTextOverdue,
                        isCompleted && styles.detailDateTextCompleted,
                      ]}
                    >
                      {dueInfo.text}
                    </Text>
                  </View>
                )}

                {/* 4. MATERIA (CON COLOR) Y TIPO DE ACTIVIDAD (SUTILES Y ALINEADOS) */}
                <View style={styles.detailMutedMetaRow}>
                  {task?.subject && (
                    <View style={styles.detailSubjectWrapper}>
                      <View
                        style={[
                          styles.detailSubjectColorDot,
                          { backgroundColor: task.subject.color || '#FFFFFF' },
                          task.subject.color === '#FFFFFF' && styles.whiteDotBorder,
                        ]}
                      />
                      <Text style={styles.detailMutedMetaText}>
                        {task.subject.name}
                      </Text>
                    </View>
                  )}
                  {task?.subject && task?.type && task.type !== 'individual' && (
                    <Text style={styles.detailMutedMetaDot}>•</Text>
                  )}
                  {task?.type && task.type !== 'individual' && (
                    <View style={styles.detailTypeWrapper}>
                      {task.type === 'proyecto' ? (
                        <Rocket size={11} color="#C084FC" />
                      ) : task.type === 'examen' ? (
                        <FileText size={11} color="#FB7185" />
                      ) : (
                        <Users size={11} color="#38BDF8" />
                      )}
                      <Text style={styles.detailMutedMetaText}>
                        {task.type}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 5. PREVIEW COMPACTO DE ADJUNTOS / FOTOS */}
                {detailAttachments.length > 0 && (
                  <View style={styles.detailAttachmentsSection}>
                    {detailAttachments.map((att: TaskAttachment, idx: number) => {
                      const isImg =
                        att.file_type === 'image' ||
                        att.file_url?.match(/\.(jpeg|jpg|png|webp|gif)/i)

                      if (isImg) {
                        return (
                          <Pressable
                            key={idx}
                            onPress={() => setSelectedLightboxImage(att.file_url)}
                            style={styles.detailImagePreviewCard}
                          >
                            <Image
                              source={{ uri: att.file_url }}
                              style={styles.detailPreviewThumbnail}
                              resizeMode="cover"
                            />
                            <View style={styles.detailPreviewInfo}>
                              <Text style={styles.detailPreviewTitle} numberOfLines={1}>
                                {att.file_name || 'Foto adjunta'}
                              </Text>
                              <Text style={styles.detailPreviewSubtitle}>Toca para ampliar</Text>
                            </View>
                            <Maximize2 size={14} color="#71717A" />
                          </Pressable>
                        )
                      }

                      return (
                        <Pressable
                          key={idx}
                          onPress={() => {
                            if (att.file_url) Linking.openURL(att.file_url)
                          }}
                          style={styles.detailLinkCard}
                        >
                          <Link2 size={15} color="#818CF8" />
                          <View style={styles.detailLinkInfo}>
                            <Text style={styles.detailLinkTitle} numberOfLines={1}>
                              {att.file_name || 'Enlace adjunto'}
                            </Text>
                          </View>
                          <ExternalLink size={13} color="#71717A" />
                        </Pressable>
                      )
                    })}
                  </View>
                )}

                {/* 6. ACCIÓN DE ELIMINAR */}
                <View style={styles.detailFooterSection}>
                  <Pressable
                    onPress={handleDelete}
                    disabled={deleteLoading}
                    style={styles.detailDeleteAction}
                  >
                    {deleteLoading ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <>
                        <Trash2 size={12} color="#EF4444" />
                        <Text style={styles.detailDeleteActionText}>Eliminar tarea</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </>
          )}

          {/* ========================================================================= */}
          {/* VISTA: FORMULARIO CREAR / EDITAR ULTRA-MINIMALISTA                       */}
          {/* ========================================================================= */}
          {currentView === 'form' && (
            <>
              <View style={styles.sheetHeader}>
                <View style={styles.dragHandle} />
                <View style={styles.headerRow}>
                  {mode === 'detail' ? (
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        Keyboard.dismiss()
                        setCurrentView('detail')
                      }}
                      hitSlop={12}
                      style={styles.backBtn}
                    >
                      <ArrowLeft size={16} color="#A1A1AA" />
                      <Text style={styles.cancelBtnText}>Volver</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </Pressable>
                  )}

                  <Text style={styles.sheetTitle}>
                    {task?.id ? 'Editar Tarea' : 'Nueva Tarea'}
                  </Text>

                  <Pressable
                    onPress={handleSave}
                    disabled={saveLoading}
                    hitSlop={12}
                    style={styles.saveHeaderBtn}
                  >
                    {saveLoading ? (
                      <ActivityIndicator size="small" color="#09090B" />
                    ) : (
                      <Text style={styles.saveHeaderBtnText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              >
                {/* Input de Título Grande y Limpio */}
                <TextInput
                  ref={titleInputRef}
                  placeholder="¿Qué tienes que hacer?"
                  placeholderTextColor="#52525B"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.cleanTitleInput}
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

                {/* Barra de Atributos Rápidos */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.attributeBar}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Selector de Materia */}
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection')
                      Keyboard.dismiss()
                      setActivePicker(activePicker === 'subject' ? null : 'subject')
                    }}
                    style={[
                      styles.attrPill,
                      selectedSubject && {
                        backgroundColor: isFormSubjWhite
                          ? 'rgba(255, 255, 255, 0.15)'
                          : `${selectedSubject.color || '#FFFFFF'}22`,
                        borderColor: isFormSubjWhite
                          ? 'rgba(255, 255, 255, 0.4)'
                          : `${selectedSubject.color || '#FFFFFF'}60`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: selectedSubject?.color || '#71717A' },
                        isFormSubjWhite && styles.whiteDotBorder,
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
                      Keyboard.dismiss()
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
                      Keyboard.dismiss()
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

                  {/* Fotos / Galería / Link */}
                  <Pressable onPress={handleTakePhoto} style={styles.attrIconPill}>
                    <Camera size={15} color="#A1A1AA" />
                  </Pressable>

                  <Pressable onPress={handlePickImage} style={styles.attrIconPill}>
                    <ImageIcon size={15} color="#A1A1AA" />
                  </Pressable>

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

                {/* Menús Desplegables de Selección */}
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
                    <Text style={styles.inlineMenuHeader}>Pegar enlace</Text>
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

                {/* Adjuntos Cargados */}
                {attachments.length > 0 && (
                  <View style={styles.attachmentsSection}>
                    {attachments.map((a) => (
                      <View key={a.id} style={styles.attachedPill}>
                        <Paperclip size={12} color="#A1A1AA" />
                        <Text style={styles.attachedPillText} numberOfLines={1}>
                          {a.file_name}
                        </Text>
                        <Pressable
                          onPress={() => {
                            triggerHaptic('light')
                            setAttachments((prev) => prev.filter((item) => item.id !== a.id))
                          }}
                          hitSlop={10}
                        >
                          <X size={12} color="#71717A" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </Animated.View>

        {/* Visor Lightbox para Fotos en Pantalla Completa */}
        {selectedLightboxImage && (
          <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setSelectedLightboxImage(null)}>
            <View style={styles.lightboxBackdrop}>
              <Pressable
                style={styles.lightboxCloseButton}
                onPress={() => setSelectedLightboxImage(null)}
                hitSlop={12}
              >
                <X size={20} color="#FFFFFF" />
              </Pressable>
              <Image
                source={{ uri: selectedLightboxImage }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              <Text style={styles.lightboxTip}>Toca la X para cerrar</Text>
            </View>
          </Modal>
        )}
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
    maxHeight: '92%',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 8,
    alignSelf: 'center',
  },
  detailHeaderBar: {
    paddingTop: 10,
    paddingBottom: 4,
    position: 'relative',
  },
  detailHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  detailEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  detailEditBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  detailScroll: {
    paddingHorizontal: 22,
  },
  detailScrollContent: {
    paddingTop: 8,
    paddingBottom: 28,
    gap: 13,
    alignItems: 'flex-start',
  },
  detailHeroTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 32,
    alignSelf: 'stretch',
  },
  detailDescriptionText: {
    color: '#D4D4D8',
    fontSize: 14.5,
    lineHeight: 22,
    alignSelf: 'stretch',
  },
  detailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  detailDateText: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
  },
  detailDateTextToday: {
    color: '#818CF8',
    fontWeight: '700',
  },
  detailDateTextOverdue: {
    color: '#F87171',
    fontWeight: '700',
  },
  detailDateTextCompleted: {
    color: '#34D399',
    fontWeight: '700',
  },
  detailMutedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  detailSubjectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailSubjectColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  detailTypeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailMutedMetaText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  detailMutedMetaDot: {
    color: '#52525B',
    fontSize: 12,
  },
  detailAttachmentsSection: {
    gap: 8,
    paddingTop: 4,
    alignSelf: 'stretch',
  },
  detailImagePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 8,
    gap: 12,
    alignSelf: 'stretch',
  },
  detailPreviewThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#27272A',
  },
  detailPreviewInfo: {
    flex: 1,
    gap: 2,
  },
  detailPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  detailPreviewSubtitle: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '500',
  },
  detailLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 11,
    gap: 10,
    alignSelf: 'stretch',
  },
  detailLinkInfo: {
    flex: 1,
  },
  detailLinkTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  detailFooterSection: {
    paddingTop: 10,
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  detailDeleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  detailDeleteActionText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '600',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  cancelBtnText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
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
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
  },
  lightboxCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  lightboxTip: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 16,
  },
})
