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
  ChevronLeft,
  ChevronUp,
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
import * as Linking from 'expo-linking'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export type TaskModalMode = 'none' | 'detail' | 'create' | 'edit'

const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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

  // Horarios de Clases
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [datePickerTab, setDatePickerTab] = useState<'class' | 'manual'>('class')
  const [selectedClassDay, setSelectedClassDay] = useState<number>(() => {
    const currentDay = new Date().getDay()
    return currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  })

  // Estado de Fecha y Hora Manual
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear())
  const [manualHour, setManualHour] = useState<number>(11)
  const [manualMinute, setManualMinute] = useState<number>(59)
  const [manualAmpm, setManualAmpm] = useState<'AM' | 'PM'>('PM')

  const titleInputRef = useRef<TextInput>(null)

  // Menús desplegables en formulario
  const [activePicker, setActivePicker] = useState<'subject' | 'type' | 'date' | 'link' | null>(null)
  const [linkUrl, setLinkUrl] = useState('')

  // Animaciones del Modal y Teclado 100% en GPU Driver Nativo (translateY)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)

  // Cargar horarios del usuario para el selector de clases
  useEffect(() => {
    if (modalVisible) {
      personalStorage.getSchedules().then((list) => {
        if (list && Array.isArray(list)) {
          setSchedules(list)
        }
      })
    }
  }, [modalVisible])

  // Sincronizar estado del calendario cuando cambie dueDate
  useEffect(() => {
    if (dueDate) {
      try {
        const d = new Date(dueDate)
        if (!isNaN(d.getTime())) {
          setCalendarMonth(d.getMonth())
          setCalendarYear(d.getFullYear())
          const h24 = d.getHours()
          setManualAmpm(h24 >= 12 ? 'PM' : 'AM')
          setManualHour(h24 % 12 || 12)
          setManualMinute(d.getMinutes())
        }
      } catch {}
    }
  }, [dueDate])

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

  // Métodos para Manipulación Manual de Fecha y Hora
  const applyManualDateTime = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    ampm: 'AM' | 'PM'
  ) => {
    triggerHaptic('selection')
    const h24 = ampm === 'PM' ? (hour % 12) + 12 : hour % 12
    const newDate = new Date(year, month, day, h24, minute, 0, 0)
    setDueDate(newDate.toISOString())
  }

  const handleSelectCalendarDay = (dayNum: number) => {
    applyManualDateTime(calendarYear, calendarMonth, dayNum, manualHour, manualMinute, manualAmpm)
  }

  const handlePrevMonth = () => {
    triggerHaptic('light')
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear((y) => y - 1)
    } else {
      setCalendarMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    triggerHaptic('light')
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear((y) => y + 1)
    } else {
      setCalendarMonth((m) => m + 1)
    }
  }

  const handleHourStep = (delta: number) => {
    triggerHaptic('selection')
    let nextH = manualHour + delta
    if (nextH > 12) nextH = 1
    if (nextH < 1) nextH = 12
    setManualHour(nextH)

    const currentD = dueDate ? new Date(dueDate) : new Date()
    applyManualDateTime(
      calendarYear,
      calendarMonth,
      currentD.getDate(),
      nextH,
      manualMinute,
      manualAmpm
    )
  }

  const handleMinuteStep = (delta: number) => {
    triggerHaptic('selection')
    let nextM = manualMinute + delta
    if (nextM >= 60) nextM = 0
    if (nextM < 0) nextM = 55
    setManualMinute(nextM)

    const currentD = dueDate ? new Date(dueDate) : new Date()
    applyManualDateTime(
      calendarYear,
      calendarMonth,
      currentD.getDate(),
      manualHour,
      nextM,
      manualAmpm
    )
  }

  const handleToggleAmpm = (newAmpm: 'AM' | 'PM') => {
    triggerHaptic('selection')
    setManualAmpm(newAmpm)

    const currentD = dueDate ? new Date(dueDate) : new Date()
    applyManualDateTime(
      calendarYear,
      calendarMonth,
      currentD.getDate(),
      manualHour,
      manualMinute,
      newAmpm
    )
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

      const hours = d.getHours()
      const mins = String(d.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const hStr = hours % 12 || 12
      const timePart = `${hStr}:${mins} ${ampm}`

      if (isToday) return `Hoy ${timePart}`
      if (isTomorrow) return `Mañana ${timePart}`
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return `${days[d.getDay()]} ${d.getDate()} (${timePart})`
    } catch {
      return 'Sin fecha'
    }
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const isFormSubjWhite = selectedSubject?.color === '#FFFFFF'

  const filteredDaySchedules = schedules
    .filter((s) => s.day_of_week === selectedClassDay)
    .sort((a, b) => (a.block_number || 0) - (b.block_number || 0))

  // Cálculos para el calendario mensual interactivo
  const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay()
  const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()

  const currentSelectedDate = dueDate ? new Date(dueDate) : null
  const isCurrentYearMonth =
    currentSelectedDate &&
    currentSelectedDate.getFullYear() === calendarYear &&
    currentSelectedDate.getMonth() === calendarMonth
  const selectedDayNumber = isCurrentYearMonth ? currentSelectedDate.getDate() : null

  const today = new Date()
  const isTodayMonth =
    today.getFullYear() === calendarYear && today.getMonth() === calendarMonth
  const todayDayNumber = isTodayMonth ? today.getDate() : null

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
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [
                { translateY: slideAnim },
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
              {/* Drag Handle Superior Centrado */}
              <View style={styles.dragHandleTopArea}>
                <View style={styles.dragHandle} />
              </View>

              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. TÍTULO DE LA TAREA + BOTONES DE ACCIÓN EN LA MISMA FILA (CERO ESPACIO VACÍO) */}
                <View style={styles.detailTitleInlineRow}>
                  <Text style={styles.detailHeroTitle} numberOfLines={2}>
                    {task?.title}
                  </Text>

                  <View style={styles.detailInlineActions}>
                    {/* Botón Eliminar como Icono */}
                    <Pressable
                      onPress={handleDelete}
                      disabled={deleteLoading}
                      hitSlop={10}
                      style={styles.detailHeaderDeleteIconBtn}
                    >
                      {deleteLoading ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Trash2 size={15} color="#EF4444" />
                      )}
                    </Pressable>

                    {/* Botón Editar como Icono */}
                    <Pressable
                      onPress={handleSwitchToEdit}
                      hitSlop={10}
                      style={styles.detailHeaderEditIconBtn}
                    >
                      <Edit2 size={15} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>

                {/* 2. NOTAS / DETALLES (TEXTO DIRECTO FLUIDO ALINEADO AL MARGEN IZQUIERDO) */}
                {Boolean(task?.description) && (
                  <Text style={styles.detailDescriptionText}>
                    {task?.description}
                  </Text>
                )}

                {/* 3. METADATOS EN UNA FILA SIMÉTRICA Y UNIFICADA (FECHA > MATERIA > TIPO) */}
                {(Boolean(dueInfo.text) || Boolean(task?.subject) || (Boolean(task?.type) && task.type !== 'individual')) && (
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

                    {Boolean(dueInfo.text) && Boolean(task?.subject) && (
                      <Text style={styles.detailMetaDot}>•</Text>
                    )}

                    {/* Materia con punto de color */}
                    {task?.subject && (
                      <View style={styles.detailMetaItem}>
                        <View
                          style={[
                            styles.detailSubjectColorDot,
                            { backgroundColor: task.subject.color || '#FFFFFF' },
                            task.subject.color === '#FFFFFF' && styles.whiteDotBorder,
                          ]}
                        />
                        <Text style={styles.detailMetaText}>
                          {task.subject.name}
                        </Text>
                      </View>
                    )}

                    {(Boolean(dueInfo.text) || Boolean(task?.subject)) && Boolean(task?.type) && task.type !== 'individual' && (
                      <Text style={styles.detailMetaDot}>•</Text>
                    )}

                    {/* Tipo de Tarea */}
                    {Boolean(task?.type) && task.type !== 'individual' && (
                      <View style={styles.detailMetaItem}>
                        {task.type === 'proyecto' ? (
                          <Rocket size={11} color="#C084FC" />
                        ) : task.type === 'examen' ? (
                          <FileText size={11} color="#FB7185" />
                        ) : (
                          <Users size={11} color="#38BDF8" />
                        )}
                        <Text style={styles.detailMetaText}>
                          {task.type}
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

                {/* SELECTOR DE FECHA CON MODO PARA CLASE Y MODO MANUAL (CALENDARIO Y HORA EXACTA) */}
                {activePicker === 'date' && (
                  <View style={styles.inlineDateMenu}>
                    {/* Selector de Modo: Para Clase vs Manual */}
                    <View style={styles.dateSegmentedRow}>
                      <Pressable
                        onPress={() => {
                          triggerHaptic('selection')
                          setDatePickerTab('class')
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
                              const isWhite = subj?.color === '#FFFFFF'

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

                    {/* MODO 2: CALENDARIO MENSUAL MANUAL Y SELECTOR DE HORA Y MINUTOS EXACTOS */}
                    {datePickerTab === 'manual' && (
                      <View style={styles.manualCalendarContainer}>
                        {/* Cabecera del Calendario con Navegación de Mes */}
                        <View style={styles.calendarNavRow}>
                          <Pressable onPress={handlePrevMonth} hitSlop={12} style={styles.calendarNavBtn}>
                            <ChevronLeft size={16} color="#FFFFFF" />
                          </Pressable>

                          <Text style={styles.calendarMonthTitle}>
                            {MONTH_NAMES[calendarMonth]} {calendarYear}
                          </Text>

                          <Pressable onPress={handleNextMonth} hitSlop={12} style={styles.calendarNavBtn}>
                            <ChevronRight size={16} color="#FFFFFF" />
                          </Pressable>
                        </View>

                        {/* Encabezados de Días de la Semana */}
                        <View style={styles.calendarWeekDaysRow}>
                          {WEEKDAY_SHORT.map((wd, idx) => (
                            <View key={idx} style={styles.calendarCell}>
                              <Text style={styles.calendarWeekDayText}>{wd}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Cuadrícula de Días del Mes */}
                        <View style={styles.calendarGrid}>
                          {Array.from({ length: firstDayIndex }).map((_, idx) => (
                            <View key={`empty_${idx}`} style={styles.calendarCell} />
                          ))}

                          {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
                            const dayNum = idx + 1
                            const isSelected = selectedDayNumber === dayNum
                            const isTodayDay = todayDayNumber === dayNum

                            return (
                              <Pressable
                                key={`day_${dayNum}`}
                                onPress={() => handleSelectCalendarDay(dayNum)}
                                style={styles.calendarCell}
                              >
                                <View
                                  style={[
                                    styles.calendarDayCircle,
                                    isSelected && styles.calendarDayCircleSelected,
                                    isTodayDay && !isSelected && styles.calendarDayCircleToday,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.calendarDayText,
                                      isSelected && styles.calendarDayTextSelected,
                                      isTodayDay && !isSelected && styles.calendarDayTextToday,
                                    ]}
                                  >
                                    {dayNum}
                                  </Text>
                                </View>
                              </Pressable>
                            )
                          })}
                        </View>

                        {/* Selector Manual de Hora y Minutos con Steppers */}
                        <View style={styles.manualTimeBox}>
                          <View style={styles.manualTimeHeader}>
                            <Clock size={12} color="#A1A1AA" />
                            <Text style={styles.miniSectionTitle}>HORA EXACTA</Text>
                          </View>

                          <View style={styles.timeControlsRow}>
                            {/* Stepper de Horas */}
                            <View style={styles.stepperContainer}>
                              <Pressable onPress={() => handleHourStep(1)} style={styles.stepperArrowBtn} hitSlop={8}>
                                <ChevronUp size={15} color="#FFFFFF" />
                              </Pressable>
                              <View style={styles.stepperDisplay}>
                                <Text style={styles.stepperDisplayText}>
                                  {String(manualHour).padStart(2, '0')}
                                </Text>
                              </View>
                              <Pressable onPress={() => handleHourStep(-1)} style={styles.stepperArrowBtn} hitSlop={8}>
                                <ChevronDown size={15} color="#FFFFFF" />
                              </Pressable>
                            </View>

                            <Text style={styles.timeColonText}>:</Text>

                            {/* Stepper de Minutos */}
                            <View style={styles.stepperContainer}>
                              <Pressable onPress={() => handleMinuteStep(5)} style={styles.stepperArrowBtn} hitSlop={8}>
                                <ChevronUp size={15} color="#FFFFFF" />
                              </Pressable>
                              <View style={styles.stepperDisplay}>
                                <Text style={styles.stepperDisplayText}>
                                  {String(manualMinute).padStart(2, '0')}
                                </Text>
                              </View>
                              <Pressable onPress={() => handleMinuteStep(-5)} style={styles.stepperArrowBtn} hitSlop={8}>
                                <ChevronDown size={15} color="#FFFFFF" />
                              </Pressable>
                            </View>

                            {/* Selector AM / PM */}
                            <View style={styles.ampmSwitchContainer}>
                              <Pressable
                                onPress={() => handleToggleAmpm('AM')}
                                style={[styles.ampmSwitchBtn, manualAmpm === 'AM' && styles.ampmSwitchBtnActive]}
                              >
                                <Text style={[styles.ampmSwitchText, manualAmpm === 'AM' && styles.ampmSwitchTextActive]}>
                                  AM
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleToggleAmpm('PM')}
                                style={[styles.ampmSwitchBtn, manualAmpm === 'PM' && styles.ampmSwitchBtnActive]}
                              >
                                <Text style={[styles.ampmSwitchText, manualAmpm === 'PM' && styles.ampmSwitchTextActive]}>
                                  PM
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>

                        {/* Botones de Acción del Selector Manual */}
                        <View style={styles.manualActionsFooter}>
                          {Boolean(dueDate) ? (
                            <Pressable
                              onPress={() => setPresetDate('clear')}
                              style={styles.dateOptionClearBtn}
                            >
                              <Text style={styles.dateOptionClearText}>Quitar fecha</Text>
                            </Pressable>
                          ) : <View />}

                          <Pressable
                            onPress={() => {
                              triggerHaptic('light')
                              setActivePicker(null)
                            }}
                            style={styles.dateOptionDoneBtn}
                          >
                            <Text style={styles.dateOptionDoneText}>Aplicar</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
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

        {/* Visor Lightbox para Fotos en Pantalla Completa (Tocar en cualquier parte cierra sin X) */}
        {selectedLightboxImage && (
          <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setSelectedLightboxImage(null)}>
            <Pressable
              style={styles.lightboxBackdrop}
              onPress={() => setSelectedLightboxImage(null)}
            >
              <Image
                source={{ uri: selectedLightboxImage }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              <Text style={styles.lightboxTip}>Toca en cualquier lugar para cerrar</Text>
            </Pressable>
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
  dragHandleTopArea: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
    marginBottom: 6,
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
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
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
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
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
    textTransform: 'capitalize',
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
  manualCalendarContainer: {
    gap: 12,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  calendarNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  calendarWeekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 4,
  },
  calendarWeekDayText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircleSelected: {
    backgroundColor: '#818CF8',
  },
  calendarDayCircleToday: {
    borderWidth: 1,
    borderColor: '#818CF8',
  },
  calendarDayText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarDayTextToday: {
    color: '#818CF8',
    fontWeight: '700',
  },
  manualTimeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    gap: 8,
  },
  manualTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniSectionTitle: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stepperContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepperArrowBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  stepperDisplay: {
    paddingVertical: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  stepperDisplayText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  timeColonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  ampmSwitchContainer: {
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  ampmSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
  },
  ampmSwitchBtnActive: {
    backgroundColor: '#818CF8',
  },
  ampmSwitchText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  ampmSwitchTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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
  },
  lightboxImage: {
    width: '100%',
    height: '82%',
  },
  lightboxTip: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 16,
  },
})
