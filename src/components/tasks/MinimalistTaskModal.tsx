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
  PanResponder,
  InteractionManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Subject, TaskType, TaskAttachment, Schedule } from '@/types/personal'
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
  ChevronRight,
  Calendar,
  Layers,
  ArrowLeft,
  Maximize2,
  Rocket,
  FileText,
  Users,
  GraduationCap,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import * as Linking from 'expo-linking'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { MinimalistPdfViewerModal } from '@/components/common/MinimalistPdfViewerModal'
import { MinimalistImageViewerModal } from '@/components/common/MinimalistImageViewerModal'
import { APPLE_EASING } from '@/constants/animations'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { DAYS_SHORT, MONTHS_SHORT } from '@/constants/dates'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export type TaskModalMode = 'none' | 'detail' | 'create' | 'edit'

function getNextClassDate(dayOfWeek: number, timeStr: string = '07:00'): Date {
  const now = new Date()
  const currentDay = now.getDay() // 0: Dom, 1: Lun, ..., 5: Vie, 6: Sáb
  const [h, m] = timeStr.split(':').map(Number)

  let daysToAdd = (dayOfWeek - currentDay + 7) % 7

  if (daysToAdd === 0) {
    const classTimeToday = new Date(now)
    classTimeToday.setHours(h, m, 0, 0)
    if (now.getTime() >= classTimeToday.getTime()) {
      daysToAdd = 7
    }
  }

  const targetDate = new Date(now)
  targetDate.setDate(targetDate.getDate() + daysToAdd)
  targetDate.setHours(h, m, 0, 0)
  return targetDate
}

function formatManualDateOnly(dateStr?: string | null): string {
  if (!dateStr) return 'Elegir día'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Elegir día'
    return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  } catch {
    return 'Elegir día'
  }
}

function formatManualTimeOnly(dateStr?: string | null): string {
  if (!dateStr) return '11:59 PM'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '11:59 PM'
    const hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  } catch {
    return '11:59 PM'
  }
}

interface MinimalistTaskModalProps {
  mode: TaskModalMode
  task: Task | null
  userId: string
  subjects: Subject[]
  onClose: () => void
  onToggleStatus?: (taskId: string, currentStatus: string) => void
  onDeleteTask?: (taskId: string) => Promise<void>
  onTaskSaved: () => void
  initialAttachments?: TaskAttachment[]
  initialTitle?: string
  initialDescription?: string
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
  initialAttachments,
  initialTitle,
  initialDescription,
}: MinimalistTaskModalProps) {
  const insets = useSafeAreaInsets()
  const [currentView, setCurrentView] = useState<'detail' | 'form'>('detail')
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<{ uri: string; title: string } | null>(null)
  const [viewingPdf, setViewingPdf] = useState<{ uri: string; title: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [taskType, setTaskType] = useState<TaskType>('individual')
  const [dueDate, setDueDate] = useState<string>('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])

  // Horarios de Clases
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [datePickerTab, setDatePickerTab] = useState<'class' | 'manual'>('class')
  const [selectedClassDay, setSelectedClassDay] = useState<number>(() => {
    const currentDay = new Date().getDay()
    return currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  })

  // Selectores Nativos de Fecha y Hora de iPhone
  const [showNativeDatePicker, setShowNativeDatePicker] = useState(false)
  const [showNativeTimePicker, setShowNativeTimePicker] = useState(false)

  const titleInputRef = useRef<TextInput>(null)

  // Menús desplegables en formulario con animación fluida
  const [activePicker, setActivePicker] = useState<'subject' | 'type' | 'date' | null>(null)
  const pickerFadeAnim = useRef(new Animated.Value(0)).current
  const pickerSlideAnim = useRef(new Animated.Value(-6)).current

  // Animaciones del Modal, Teclado y Gesto PanResponder
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const panY = useRef(new Animated.Value(0)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)

  // Disparar animación de entrada suave al abrir o cambiar de picker
  useEffect(() => {
    if (activePicker) {
      pickerFadeAnim.setValue(0)
      pickerSlideAnim.setValue(-6)
      Animated.parallel([
        Animated.timing(pickerFadeAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(pickerSlideAnim, {
          toValue: 0,
          stiffness: 500,
          damping: 28,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [activePicker, datePickerTab, showNativeDatePicker, showNativeTimePicker])

  // Cargar horarios del usuario para el selector de clases (después de interacciones para no bloquear FPS)
  useEffect(() => {
    if (modalVisible) {
      const handle = InteractionManager.runAfterInteractions(() => {
        personalStorage.getSchedules().then((list) => {
          if (list && Array.isArray(list)) {
            setSchedules(list)
          }
        })
      })
      return () => handle.cancel()
    }
  }, [modalVisible])

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
        setTitle(initialTitle || '')
        setDescription(initialDescription || '')
        setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
        setTaskType('individual')
        setDueDate('')
        setAttachments(initialAttachments && initialAttachments.length > 0 ? initialAttachments : [])
      } else if (task && (mode === 'edit' || mode === 'detail')) {
        setTitle(task.title || '')
        setDescription(task.description || '')
        setSelectedSubjectId(task.subject_id || null)
        setTaskType(task.type || 'individual')
        setDueDate(task.due_date || '')
        setAttachments(Array.isArray(task.attachments) ? task.attachments : [])
      }
      setActivePicker(null)
      setShowNativeDatePicker(false)
      setShowNativeTimePicker(false)
      panY.setValue(0)
      keyboardTranslateY.setValue(0)
      slideAnim.setValue(SCREEN_HEIGHT)
      fadeAnim.setValue(0)

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && mode === 'create') {
          requestAnimationFrame(() => {
            titleInputRef.current?.focus()
          })
        }
      })
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
        Animated.timing(panY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
      })
    }
  }, [mode, task?.id, initialTitle, initialDescription, initialAttachments])

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
      Animated.timing(panY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose()
    })
  }

  // PanResponder Amplio para Deslizar Hacia Abajo y Cerrar (Abarca tirador, título y botones de acción)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 95 || gestureState.vy > 0.45) {
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

  const isCompleted = task?.status === 'completed'

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return { text: '', isOverdue: false, isToday: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: '', isOverdue: false, isToday: false }
      const now = new Date()
      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()
      const dayName = DAYS_SHORT[date.getDay()]
      const dayNum = date.getDate()
      const monthName = MONTHS_SHORT[date.getMonth()]
      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isToday) {
        return { text: `Hoy, ${timeStr}`, isOverdue: false, isToday: true }
      }
      if (isPast && !isCompleted) {
        return { text: `Venció ${dayName} ${dayNum} ${monthName}`, isOverdue: true, isToday: false }
      }
      return { text: `${dayName} ${dayNum} ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
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
    Keyboard.dismiss()
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setSelectedSubjectId(task.subject_id || null)
      setTaskType(task.type || 'individual')
      setDueDate(task.due_date || '')
      setAttachments(Array.isArray(task.attachments) ? task.attachments : [])
    }
    setCurrentView('form')
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
          subject: selectedSubj || null,
        }
        await personalStorage.saveTask(fullTask)
      } else {
        const newId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        const fullTask: Task = {
          id: newId,
          ...payload,
          subject: selectedSubj || null,
          created_at: new Date().toISOString(),
        }
        await personalStorage.saveTask(fullTask)
      }

      triggerHaptic('success')
      onTaskSaved?.()
      handleSmoothClose()
    } catch (err) {
      console.error('Error al guardar tarea:', err)
      Alert.alert('Error', 'No se pudo guardar la tarea.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleSelectClass = (sched: Schedule, subj?: Subject | null) => {
    triggerHaptic('success')
    const targetDate = getNextClassDate(sched.day_of_week, sched.start_time || '07:00')
    setDueDate(targetDate.toISOString())
    if (sched.subject_id) {
      setSelectedSubjectId(sched.subject_id)
    } else if (subj?.id) {
      setSelectedSubjectId(subj.id)
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
        file_name: asset.fileName || 'Imagen',
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
        file_name: 'Imagen',
        file_url: asset.uri,
        file_type: 'image',
        size_bytes: asset.fileSize || 0,
      }
      setAttachments((prev) => [...prev, newAttachment])
      triggerHaptic('success')
    }
  }

  const handlePickDocument = async () => {
    triggerHaptic('light')
    Keyboard.dismiss()
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        const newAttachment: TaskAttachment = {
          id: Math.random().toString(36).substring(7),
          file_name: asset.name || 'Documento',
          file_url: asset.uri,
          file_type: 'document',
          size_bytes: asset.size,
        }
        setAttachments((prev) => [...prev, newAttachment])
        triggerHaptic('success')
      }
    } catch (err: any) {
      console.error('Error al seleccionar documento:', err)
      Alert.alert('Error', 'No se pudo seleccionar el archivo.')
      triggerHaptic('error')
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

      const hours = d.getHours()
      const mins = String(d.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const hStr = hours % 12 || 12
      const timePart = `${hStr}:${mins} ${ampm}`

      if (isToday) return `Hoy ${timePart}`
      if (isTomorrow) return `Mañana ${timePart}`
      return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} (${timePart})`
    } catch {
      return 'Sin fecha'
    }
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const isFormSubjWhite = isWhiteColor(selectedSubject?.color)

  const filteredDaySchedules = schedules
    .filter((s) => s.day_of_week === selectedClassDay)
    .sort((a, b) => (a.block_number || 0) - (b.block_number || 0))

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop Estático con Fade (useNativeDriver: true) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante con PanResponder (useNativeDriver: true 100% GPU) */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [
                { translateY: slideAnim },
                { translateY: panY },
                { translateY: keyboardTranslateY },
              ],
            },
          ]}
        >
          {/* ========================================================================= */}
          {/* VISTA: DETALLE 100% SIMÉTRICO Y SIN ESPACIOS VACÍOS                       */}
          {/* ========================================================================= */}
          {currentView === 'detail' && (
            <>
              {/* ZONA SUPERIOR COMPLETA CON GESTO DE DESLIZAR (Tirador + Título + Acciones) */}
              <View {...panResponder.panHandlers}>
                {/* Tirador Superior Grande */}
                <View style={styles.dragHandleTopArea}>
                  <View style={styles.dragHandle} />
                </View>

                {/* 1. TÍTULO DE LA TAREA (SIMÉTRICO Y ELEGANTE) */}
                <View style={styles.detailTitleInlineRow}>
                  <Text style={styles.detailHeroTitle} numberOfLines={2}>
                    {task?.title}
                  </Text>
                </View>
              </View>

              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 2. NOTAS / DETALLES (TEXTO DIRECTO FLUIDO ALINEADO AL MARGEN IZQUIERDO) */}
                {Boolean(task?.description) && (
                  <Text style={styles.detailDescriptionText}>
                    {task?.description}
                  </Text>
                )}

                {/* 3. METADATOS EN UNA FILA SIMÉTRICA Y UNIFICADA (FECHA > MATERIA > TIPO) */}
                {(Boolean(dueInfo.text) || Boolean(task?.subject) || (Boolean(task?.type) && task?.type !== 'individual')) && (
                  <View style={styles.detailUnifiedMetaRow}>
                    {/* Fecha de Entrega */}
                    {Boolean(dueInfo.text) && (
                      <View style={styles.detailMetaItem}>
                        <Clock
                          size={12.5}
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
                            styles.detailMetaText,
                            dueInfo.isToday && styles.detailMetaTextToday,
                            dueInfo.isOverdue && styles.detailMetaTextOverdue,
                            isCompleted && styles.detailMetaTextCompleted,
                          ]}
                        >
                          {dueInfo.text}
                        </Text>
                      </View>
                    )}

                    {Boolean(dueInfo.text) && (
                      <Text style={styles.detailMetaDot}>•</Text>
                    )}

                    {/* Materia con punto de color */}
                    <View style={styles.detailMetaItem}>
                      <View
                        style={[
                          styles.detailSubjectColorDot,
                          { backgroundColor: task?.subject?.color || '#71717A' },
                          isWhiteColor(task?.subject?.color) && styles.whiteDotBorder,
                        ]}
                      />
                      <Text style={styles.detailMetaText}>
                        {task?.subject?.name || 'General'}
                      </Text>
                    </View>

                    {(Boolean(dueInfo.text) || Boolean(task?.subject)) && Boolean(task?.type) && task?.type !== 'individual' && (
                      <Text style={styles.detailMetaDot}>•</Text>
                    )}

                    {/* Tipo de Tarea */}
                    {Boolean(task?.type) && task?.type !== 'individual' && (
                      <View style={styles.detailMetaItem}>
                        {task?.type === 'proyecto' ? (
                          <Rocket size={11} color="#C084FC" />
                        ) : task?.type === 'examen' ? (
                          <FileText size={11} color="#FB7185" />
                        ) : (
                          <Users size={11} color="#38BDF8" />
                        )}
                        <Text style={styles.detailMetaText}>
                          {task?.type}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 4. PREVIEW COMPACTO DE ADJUNTOS / FOTOS */}
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
                            onPress={() =>
                              setSelectedLightboxImage({
                                uri: att.file_url,
                                title: att.file_name || 'Imagen',
                              })
                            }
                            style={styles.detailImagePreviewCard}
                          >
                            <Image
                              source={{ uri: att.file_url }}
                              style={styles.detailPreviewThumbnail}
                              resizeMode="cover"
                            />
                            <View style={styles.detailPreviewInfo}>
                              <Text style={styles.detailPreviewTitle} numberOfLines={1}>
                                {att.file_name || 'Imagen'}
                              </Text>
                              <Text style={styles.detailPreviewSubtitle}>Toca para ampliar y hacer zoom</Text>
                            </View>
                            <Maximize2 size={14} color="#71717A" />
                          </Pressable>
                        )
                      }

                      // Documentos (PDF, Word, Excel, etc.) o Enlaces
                      const isPdf = att.file_name?.toLowerCase().endsWith('.pdf')
                      const isWord = Boolean(att.file_name?.toLowerCase().match(/\.(doc|docx)$/))
                      const isExcel = Boolean(att.file_name?.toLowerCase().match(/\.(xls|xlsx)$/))
                      const isPpt = Boolean(att.file_name?.toLowerCase().match(/\.(ppt|pptx)$/))

                      const getBadgeInfo = () => {
                        if (isPdf) return { label: 'PDF', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171' }
                        if (isWord) return { label: 'DOC', bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA' }
                        if (isExcel) return { label: 'XLS', bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80' }
                        if (isPpt) return { label: 'PPT', bg: 'rgba(249, 115, 22, 0.15)', text: '#FB923C' }
                        if (att.file_type === 'link' || att.file_url?.startsWith('http')) {
                          return { label: 'LINK', bg: 'rgba(129, 140, 248, 0.15)', text: '#818CF8' }
                        }
                        return { label: 'FILE', bg: 'rgba(255, 255, 255, 0.1)', text: '#D4D4D8' }
                      }
                      const badge = getBadgeInfo()

                      const formatFileSize = (bytes?: number) => {
                        if (!bytes || bytes <= 0) return 'Toca para abrir o compartir'
                        if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB • Toca para abrir`
                        return `${(bytes / 1024).toFixed(0)} KB • Toca para abrir`
                      }

                      const handleOpenAttachment = async () => {
                        triggerHaptic('light')
                        if (isPdf && att.file_url) {
                          setViewingPdf({ uri: att.file_url, title: att.file_name })
                          return
                        }

                        if (att.file_url?.startsWith('http://') || att.file_url?.startsWith('https://')) {
                          Linking.openURL(att.file_url)
                        } else {
                          try {
                            const isAvailable = await Sharing.isAvailableAsync()
                            if (isAvailable) {
                              await Sharing.shareAsync(att.file_url, {
                                dialogTitle: att.file_name,
                                mimeType: isPdf ? 'application/pdf' : undefined,
                                UTI: isPdf ? 'com.adobe.pdf' : undefined,
                              })
                            } else {
                              Linking.openURL(att.file_url)
                            }
                          } catch (err) {
                            console.error('Error al abrir archivo:', err)
                            Alert.alert('Aviso', 'No se pudo abrir el archivo.')
                          }
                        }
                      }

                      return (
                        <Pressable
                          key={idx}
                          onPress={handleOpenAttachment}
                          style={styles.detailDocCard}
                        >
                          <View style={[styles.docTypeBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.docTypeBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                          <View style={styles.detailDocInfo}>
                            <Text style={styles.detailDocTitle} numberOfLines={1}>
                              {att.file_name || 'Archivo adjunto'}
                            </Text>
                            <Text style={styles.detailDocSubtitle}>
                              {formatFileSize(att.size_bytes)}
                            </Text>
                          </View>
                          <ExternalLink size={14} color="#71717A" />
                        </Pressable>
                      )
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          )}

          {/* ========================================================================= */}
          {/* VISTA: FORMULARIO CREAR / EDITAR ULTRA-MINIMALISTA                       */}
          {/* ========================================================================= */}
          {currentView === 'form' && (
            <>
              <View style={styles.sheetHeader} {...panResponder.panHandlers}>
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
                      style={styles.backTitleBtn}
                    >
                      <ArrowLeft size={18} color="#FFFFFF" />
                      <Text style={styles.sheetTitle}>Editar Tarea</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.sheetTitle}>Nueva Tarea</Text>
                  )}

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

                {/* Barra de Atributos Rápidos (Con Espaciado Amplio y Holgado) */}
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

                  {/* Selector de Fecha (Manual o Por Clase) */}
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

                  <Pressable onPress={handlePickDocument} style={styles.attrIconPill}>
                    <FileText size={15} color="#A1A1AA" />
                  </Pressable>
                </ScrollView>

                {/* Menús Desplegables de Selección con Transición Animada */}
                {activePicker === 'subject' && (
                  <Animated.View
                    style={{
                      opacity: pickerFadeAnim,
                      transform: [{ translateY: pickerSlideAnim }],
                    }}
                  >
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
                        const isSubjWhite = isWhiteColor(s.color)
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
                  </Animated.View>
                )}

                {/* SELECTOR DE FECHA CON MODO PARA CLASE Y MODO MANUAL NATIVO DE IPHONE */}
                {activePicker === 'date' && (
                  <Animated.View
                    style={{
                      opacity: pickerFadeAnim,
                      transform: [{ translateY: pickerSlideAnim }],
                    }}
                  >
                    <View style={styles.inlineDateMenu}>
                      {/* Selector de Modo: Para Clase vs Manual */}
                      <View style={styles.dateSegmentedRow}>
                        <Pressable
                          onPress={() => {
                            triggerHaptic('selection')
                            setDatePickerTab('class')
                            setShowNativeDatePicker(false)
                            setShowNativeTimePicker(false)
                          }}
                          style={[
                            styles.dateSegmentBtn,
                            datePickerTab === 'class' && styles.dateSegmentBtnActive,
                          ]}
                        >
                          <GraduationCap
                            size={13}
                            color={datePickerTab === 'class' ? '#FFFFFF' : '#71717A'}
                          />
                          <Text
                            style={[
                              styles.dateSegmentText,
                              datePickerTab === 'class' && styles.dateSegmentTextActive,
                            ]}
                          >
                            Para Clase
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => {
                            triggerHaptic('selection')
                            setDatePickerTab('manual')
                          }}
                          style={[
                            styles.dateSegmentBtn,
                            datePickerTab === 'manual' && styles.dateSegmentBtnActive,
                          ]}
                        >
                          <Calendar
                            size={13}
                            color={datePickerTab === 'manual' ? '#FFFFFF' : '#71717A'}
                          />
                          <Text
                            style={[
                              styles.dateSegmentText,
                              datePickerTab === 'manual' && styles.dateSegmentTextActive,
                            ]}
                          >
                            Manual
                          </Text>
                        </Pressable>
                      </View>

                      {/* MODO 1: MINI CALENDARIO / SELECCIÓN DE CLASE */}
                      {datePickerTab === 'class' && (
                        <View style={styles.classPickerContainer}>
                          {/* Selector de Día de la Semana */}
                          <View style={styles.classDayBar}>
                            {[
                              { day: 1, label: 'Lun' },
                              { day: 2, label: 'Mar' },
                              { day: 3, label: 'Mié' },
                              { day: 4, label: 'Jue' },
                              { day: 5, label: 'Vie' },
                            ].map((d) => {
                              const isSelected = selectedClassDay === d.day
                              return (
                                <Pressable
                                  key={d.day}
                                  onPress={() => {
                                    triggerHaptic('selection')
                                    setSelectedClassDay(d.day)
                                  }}
                                  style={[
                                    styles.classDayPill,
                                    isSelected && styles.classDayPillActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.classDayText,
                                      isSelected && styles.classDayTextActive,
                                    ]}
                                  >
                                    {d.label}
                                  </Text>
                                </Pressable>
                              )
                            })}
                          </View>

                          {/* Lista de Clases del Día Seleccionado */}
                          <View style={styles.classListContainer}>
                            {filteredDaySchedules.length === 0 ? (
                              <View style={styles.emptyClassesBox}>
                                <Text style={styles.emptyClassesText}>
                                  Sin clases configuradas para este día
                                </Text>
                              </View>
                            ) : (
                              filteredDaySchedules.map((sched) => {
                                const subj =
                                  subjects.find((s) => s.id === sched.subject_id) ||
                                  sched.subject
                                const isWhite = isWhiteColor(subj?.color)

                                return (
                                  <Pressable
                                    key={sched.id || `${sched.day_of_week}_${sched.block_number}`}
                                    onPress={() => handleSelectClass(sched, subj)}
                                    style={styles.classCardRow}
                                  >
                                    <View style={styles.classTimeBox}>
                                      <Clock size={11} color="#818CF8" />
                                      <Text style={styles.classTimeText}>
                                        {sched.start_time || '07:00'}
                                      </Text>
                                    </View>

                                    <View style={styles.classSubjectInfo}>
                                      <View style={styles.classSubjectTitleRow}>
                                        <View
                                          style={[
                                            styles.dot,
                                            { backgroundColor: subj?.color || '#FFFFFF' },
                                            isWhite && styles.whiteDotBorder,
                                          ]}
                                        />
                                        <Text
                                          style={styles.classSubjectName}
                                          numberOfLines={1}
                                        >
                                          {subj?.name || 'Materia'}
                                        </Text>
                                      </View>
                                      {sched.classroom_room && (
                                        <Text style={styles.classRoomText}>
                                          {sched.classroom_room}
                                        </Text>
                                      )}
                                    </View>

                                    <ChevronRight size={13} color="#71717A" />
                                  </Pressable>
                                )
                              })
                            )}
                          </View>
                        </View>
                      )}

                      {/* MODO 2: DOS BOTONES LIMPIOS (FECHA Y HORA) CON SELECTORES NATIVOS DE IPHONE */}
                      {datePickerTab === 'manual' && (
                        <View style={styles.nativePickerContainer}>
                          <View style={styles.nativeButtonsRow}>
                            {/* Botón 1: Elegir Fecha */}
                            <Pressable
                              onPress={() => {
                                triggerHaptic('light')
                                if (!dueDate) {
                                  const now = new Date()
                                  now.setHours(23, 59, 0, 0)
                                  setDueDate(now.toISOString())
                                }
                                setShowNativeDatePicker((prev) => !prev)
                                setShowNativeTimePicker(false)
                              }}
                              style={[
                                styles.nativePickerBtn,
                                showNativeDatePicker && styles.nativePickerBtnActive,
                              ]}
                            >
                              <Calendar size={15} color={showNativeDatePicker ? '#818CF8' : '#A1A1AA'} />
                              <View style={styles.nativeBtnInfo}>
                                <Text style={styles.nativeBtnLabel}>Fecha</Text>
                                <Text style={styles.nativeBtnValue} numberOfLines={1}>
                                {formatManualDateOnly(dueDate)}
                              </Text>
                            </View>
                          </Pressable>

                          {/* Botón 2: Elegir Hora */}
                          <Pressable
                            onPress={() => {
                              triggerHaptic('light')
                              if (!dueDate) {
                                const now = new Date()
                                now.setHours(23, 59, 0, 0)
                                setDueDate(now.toISOString())
                              }
                              setShowNativeTimePicker((prev) => !prev)
                              setShowNativeDatePicker(false)
                            }}
                            style={[
                              styles.nativePickerBtn,
                              showNativeTimePicker && styles.nativePickerBtnActive,
                            ]}
                          >
                            <Clock size={15} color={showNativeTimePicker ? '#818CF8' : '#A1A1AA'} />
                            <View style={styles.nativeBtnInfo}>
                              <Text style={styles.nativeBtnLabel}>Hora</Text>
                              <Text style={styles.nativeBtnValue} numberOfLines={1}>
                                {formatManualTimeOnly(dueDate)}
                              </Text>
                            </View>
                          </Pressable>
                        </View>

                        {/* Selector Nativo de Fecha de iOS */}
                        {showNativeDatePicker && (
                          <View style={styles.nativePickerBox}>
                            <DateTimePicker
                              value={dueDate ? new Date(dueDate) : new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'inline' : 'default'}
                              themeVariant="dark"
                              locale="es-ES"
                              onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                                if (selectedDate) {
                                  const current = dueDate ? new Date(dueDate) : new Date()
                                  selectedDate.setHours(current.getHours(), current.getMinutes(), 0, 0)
                                  setDueDate(selectedDate.toISOString())
                                  triggerHaptic('selection')
                                }
                              }}
                            />
                          </View>
                        )}

                        {/* Selector Nativo de Hora de iOS */}
                        {showNativeTimePicker && (
                          <View style={styles.nativePickerBox}>
                            <DateTimePicker
                              value={dueDate ? new Date(dueDate) : new Date()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              themeVariant="dark"
                              locale="es-ES"
                              onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                                if (selectedDate) {
                                  const current = dueDate ? new Date(dueDate) : new Date()
                                  current.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0)
                                  setDueDate(current.toISOString())
                                  triggerHaptic('selection')
                                }
                              }}
                            />
                          </View>
                        )}

                        {/* Acciones */}
                        {Boolean(dueDate) && (
                          <View style={styles.manualActionsFooter}>
                            <Pressable
                              onPress={() => {
                                setDueDate('')
                                setShowNativeDatePicker(false)
                                setShowNativeTimePicker(false)
                                setActivePicker(null)
                              }}
                              style={styles.dateOptionClearBtn}
                            >
                              <Text style={styles.dateOptionClearText}>Quitar fecha</Text>
                            </Pressable>

                            <Pressable
                              onPress={() => {
                                triggerHaptic('light')
                                setShowNativeDatePicker(false)
                                setShowNativeTimePicker(false)
                                setActivePicker(null)
                              }}
                              style={styles.dateOptionDoneBtn}
                            >
                              <Text style={styles.dateOptionDoneText}>Listo</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </Animated.View>
                )}

                {activePicker === 'type' && (
                  <Animated.View
                    style={{
                      opacity: pickerFadeAnim,
                      transform: [{ translateY: pickerSlideAnim }],
                    }}
                  >
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
                  </Animated.View>
                )}

                {/* Adjuntos Cargados */}
                {attachments.length > 0 && (
                  <View style={styles.attachmentsSection}>
                    {attachments.map((a) => {
                      const isImg = a.file_type === 'image' || a.file_url?.match(/\.(jpeg|jpg|png|webp|gif)/i)
                      const isPdf = a.file_name?.toLowerCase().endsWith('.pdf')
                      const isWord = Boolean(a.file_name?.toLowerCase().match(/\.(doc|docx)$/))

                      return (
                        <View key={a.id} style={styles.attachedPill}>
                          <Pressable
                            onPress={() => {
                              if (isImg && a.file_url) {
                                triggerHaptic('light')
                                setSelectedLightboxImage({
                                  uri: a.file_url,
                                  title: a.file_name || 'Imagen',
                                })
                              } else if (isPdf && a.file_url) {
                                triggerHaptic('light')
                                setViewingPdf({
                                  uri: a.file_url,
                                  title: a.file_name || 'Documento PDF',
                                })
                              }
                            }}
                            style={styles.attachedPillContent}
                          >
                            {isImg ? (
                              <ImageIcon size={12} color="#A1A1AA" />
                            ) : (
                              <FileText size={12} color={isPdf ? '#F87171' : isWord ? '#60A5FA' : '#A1A1AA'} />
                            )}
                            <Text style={styles.attachedPillText} numberOfLines={1}>
                              {a.file_name}
                            </Text>
                          </Pressable>
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
                      )
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </Animated.View>

        {/* Visor Interactivo con Zoom para Fotos (Pinch-to-zoom, doble toque, pan y compartir) */}
        <MinimalistImageViewerModal
          visible={Boolean(selectedLightboxImage)}
          imageUri={selectedLightboxImage?.uri || null}
          imageTitle={selectedLightboxImage?.title || 'Imagen'}
          onClose={() => setSelectedLightboxImage(null)}
        />

        {/* Visor Nativo Integrado para Documentos PDF (Solo montado cuando se necesita) */}
        {Boolean(viewingPdf) && (
          <MinimalistPdfViewerModal
            visible={Boolean(viewingPdf)}
            pdfUri={viewingPdf?.uri || null}
            pdfTitle={viewingPdf?.title || ''}
            onClose={() => setViewingPdf(null)}
          />
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
    ...StyleSheet.absoluteFill,
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
  dragHandleTopArea: {
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  dragHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#52525B',
  },
  detailScroll: {
    paddingHorizontal: 22,
  },
  detailScrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  detailTitleInlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 22,
    paddingBottom: 4,
    gap: 12,
  },
  detailHeroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
    flex: 1,
  },
  detailInlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  detailHeaderDeleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderEditIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailDescriptionText: {
    color: '#D4D4D8',
    fontSize: 14.5,
    lineHeight: 22,
    alignSelf: 'stretch',
  },
  detailUnifiedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    paddingTop: 2,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
  },
  detailMetaText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '500',
  },
  detailMetaTextToday: {
    color: '#818CF8',
    fontWeight: '600',
  },
  detailMetaTextOverdue: {
    color: '#F87171',
    fontWeight: '600',
  },
  detailMetaTextCompleted: {
    color: '#34D399',
    fontWeight: '600',
  },
  detailMetaDot: {
    color: '#3F3F46',
    fontSize: 12,
  },
  detailSubjectColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
  detailDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    alignSelf: 'stretch',
  },
  docTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailDocInfo: {
    flex: 1,
    gap: 2,
  },
  detailDocTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  detailDocSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  backTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  saveHeaderBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 7,
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
  whiteDotBorder: WHITE_DOT_BORDER,
  cleanTitleInput: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    paddingVertical: 8,
    letterSpacing: -0.4,
  },
  cleanDescInput: {
    color: '#A1A1AA',
    fontSize: 14.5,
    lineHeight: 21,
    paddingVertical: 8,
    minHeight: 50,
  },
  attributeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 8,
  },
  attrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8.5,
    borderRadius: 13,
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
    fontSize: 12.5,
    fontWeight: '600',
  },
  attrPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  attrIconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  inlineDateMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    gap: 12,
  },
  dateSegmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  dateSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7.5,
    borderRadius: 8,
    gap: 6,
  },
  dateSegmentBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  dateSegmentText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  dateSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  classPickerContainer: {
    gap: 10,
  },
  classDayBar: {
    flexDirection: 'row',
    gap: 6,
  },
  classDayPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  classDayPillActive: {
    backgroundColor: '#818CF8',
  },
  classDayText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  classDayTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  classListContainer: {
    gap: 6,
  },
  emptyClassesBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyClassesText: {
    color: '#71717A',
    fontSize: 12,
  },
  classCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  classTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  classTimeText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  classSubjectInfo: {
    flex: 1,
    gap: 2,
  },
  classSubjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classSubjectName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  classRoomText: {
    color: '#71717A',
    fontSize: 11,
  },
  nativePickerContainer: {
    gap: 12,
  },
  nativeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nativePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  nativePickerBtnActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: '#818CF8',
  },
  nativeBtnInfo: {
    flex: 1,
    gap: 1,
  },
  nativeBtnLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  nativeBtnValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  nativePickerBox: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  manualActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  dateOptionDoneBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
  dateOptionDoneText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '800',
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
  attachedPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachedPillText: {
    color: '#D4D4D8',
    fontSize: 11.5,
    maxWidth: 160,
  },
})
