import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  TextInput,
  Modal,
  Animated,
  ActivityIndicator,
  Platform,
  Keyboard,
  Easing,
  PanResponder,
} from 'react-native'

const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage } from '@/lib/personalStorage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Sparkles,
  Smartphone,
  Edit3,
  X,
  Check,
  ChevronRight,
  Bell,
  Clock,
  BookOpen,
  Trash2,
  Settings as SettingsIcon,
  Calendar,
  RotateCcw,
} from 'lucide-react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import {
  syncAllNotifications,
  requestNotificationPermissions,
} from '@/lib/personalNotifications'
import { useRouter, useFocusEffect } from 'expo-router'
import { MinimalistVitalStats } from '@/components/stats/MinimalistVitalStats'
import { MinimalistActivityHeatmap } from '@/components/stats/MinimalistActivityHeatmap'
import { MinimalistSubjectBalance } from '@/components/stats/MinimalistSubjectBalance'

const PRESET_HOURS = [
  { time: '18:00', label: '6:00 PM', desc: 'Tarde' },
  { time: '19:00', label: '7:00 PM', desc: 'Atardecer' },
  { time: '20:00', label: '8:00 PM', desc: 'Noche (Recomendado)' },
  { time: '21:00', label: '9:00 PM', desc: 'Noche' },
  { time: '22:00', label: '10:00 PM', desc: 'Antes de dormir' },
]

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function parseDateString(str?: string, defaultYear?: number, defaultMonth?: number, defaultDay?: number): Date {
  if (str) {
    const parts = str.split('-').map((p) => parseInt(p, 10))
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
    }
  }
  const y = defaultYear || new Date().getFullYear()
  const m = defaultMonth !== undefined ? defaultMonth : 0
  const d = defaultDay || 1
  return new Date(y, m, d, 12, 0, 0)
}

function formatDateToKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatReadableDate(str?: string, fallback: string = ''): string {
  if (!str) return fallback
  try {
    const parts = str.split('-').map((n) => parseInt(n, 10))
    const m = parts[1]
    const d = parts[2]
    return `${d} ${MONTH_NAMES_SHORT[m - 1]}`
  } catch {
    return fallback
  }
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, updateProfile, clearData } = usePersonalAuth()

  // Preferencias del Sistema
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
  const [advanceReminderEnabled, setAdvanceReminderEnabled] = useState(true)
  const [advanceReminderTime, setAdvanceReminderTime] = useState('20:00')
  const [classReminderEnabled, setClassReminderEnabled] = useState(true)

  // Periodos de Semestre
  const currentYear = new Date().getFullYear()
  const [fallStart, setFallStart] = useState(`${currentYear}-08-01`)
  const [fallEnd, setFallEnd] = useState(`${currentYear}-12-31`)
  const [springStart, setSpringStart] = useState(`${currentYear}-02-01`)
  const [springEnd, setSpringEnd] = useState(`${currentYear}-06-30`)
  const [activeDatePicker, setActiveDatePicker] = useState<
    'fall_start' | 'fall_end' | 'spring_start' | 'spring_end' | null
  >(null)

  // Modal Principal de Ajustes del Sistema (Secundario)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const settingsFadeAnim = useRef(new Animated.Value(0)).current
  const settingsSlideAnim = useRef(new Animated.Value(500)).current
  const settingsPanY = useRef(new Animated.Value(0)).current

  // Modal de Selección de Hora de Recordatorio
  const [showTimeModal, setShowTimeModal] = useState(false)
  const timeFadeAnim = useRef(new Animated.Value(0)).current
  const timeSlideAnim = useRef(new Animated.Value(300)).current

  // Modal de Edición de Perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editName, setEditName] = useState(profile?.full_name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const nameInputRef = useRef<TextInput>(null)
  const editFadeAnim = useRef(new Animated.Value(0)).current
  const editSlideAnim = useRef(new Animated.Value(300)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current

  // Sincronización instantánea con el teclado de iOS
  useEffect(() => {
    if (!showEditProfileModal) return

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
  }, [showEditProfileModal, insets.bottom, keyboardTranslateY])

  const loadData = useCallback(async () => {
    const prefs = await personalStorage.getPreferences()
    setHapticsEnabled(prefs.haptics_enabled)
    setConfettiEnabled(prefs.confetti_enabled)
    setAdvanceReminderEnabled(prefs.advance_reminder_enabled)
    setAdvanceReminderTime(prefs.advance_reminder_time || '20:00')
    setClassReminderEnabled(prefs.class_reminder_enabled)
    setGlobalHapticsEnabled(prefs.haptics_enabled)
    if (prefs.semester_fall_start) setFallStart(prefs.semester_fall_start)
    if (prefs.semester_fall_end) setFallEnd(prefs.semester_fall_end)
    if (prefs.semester_spring_start) setSpringStart(prefs.semester_spring_start)
    if (prefs.semester_spring_end) setSpringEnd(prefs.semester_spring_end)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // ==========================================
  // MANEJO DEL MODAL DE AJUSTES (HOJA DESLIZANTE)
  // ==========================================
  const handleOpenSettings = () => {
    triggerHaptic('light')
    setShowSettingsModal(true)
    settingsSlideAnim.setValue(500)
    settingsFadeAnim.setValue(0)
    settingsPanY.setValue(0)

    Animated.parallel([
      Animated.timing(settingsFadeAnim, { toValue: 1, duration: 180, easing: APPLE_EASING, useNativeDriver: true }),
      Animated.spring(settingsSlideAnim, { toValue: 0, stiffness: 450, damping: 30, mass: 0.8, useNativeDriver: true }),
    ]).start()
  }

  const handleCloseSettings = () => {
    triggerHaptic('light')
    Animated.parallel([
      Animated.timing(settingsFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(settingsSlideAnim, { toValue: 500, duration: 180, useNativeDriver: true }),
      Animated.timing(settingsPanY, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setShowSettingsModal(false)
    })
  }

  const settingsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          settingsPanY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 90 || gestureState.vy > 0.45) {
          handleCloseSettings()
        } else {
          Animated.spring(settingsPanY, {
            toValue: 0,
            damping: 24,
            stiffness: 400,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  // ==========================================
  // MANEJO DEL MODAL DE EDICIÓN DE PERFIL
  // ==========================================
  const handleOpenEditProfile = () => {
    triggerHaptic('light')
    setEditName(profile?.full_name || '')
    setShowEditProfileModal(true)
    editSlideAnim.setValue(300)
    editFadeAnim.setValue(0)
    keyboardTranslateY.setValue(0)

    Animated.parallel([
      Animated.timing(editFadeAnim, { toValue: 1, duration: 180, easing: APPLE_EASING, useNativeDriver: true }),
      Animated.timing(editSlideAnim, { toValue: 0, duration: 220, easing: APPLE_EASING, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        requestAnimationFrame(() => {
          nameInputRef.current?.focus()
        })
      }
    })
  }

  const handleCloseEditProfile = () => {
    triggerHaptic('light')
    Keyboard.dismiss()
    Animated.parallel([
      Animated.timing(editFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(editSlideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
      Animated.timing(keyboardTranslateY, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setShowEditProfileModal(false)
    })
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      triggerHaptic('error')
      Alert.alert('Requerido', 'Ingresa un nombre válido.')
      return
    }

    setSavingProfile(true)
    triggerHaptic('medium')
    try {
      await updateProfile(editName.trim())
      triggerHaptic('success')
      handleCloseEditProfile()
    } catch (err: any) {
      triggerHaptic('error')
      Alert.alert('Error', err.message || 'No se pudo actualizar el perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ==========================================
  // MANEJO DE PREFERENCIAS
  // ==========================================
  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val)
    setGlobalHapticsEnabled(val)
    if (val) triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, haptics_enabled: val })
  }

  const handleToggleConfetti = async (val: boolean) => {
    setConfettiEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, confetti_enabled: val })
  }

  const handleToggleAdvanceReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        Alert.alert(
          'Permiso de Notificaciones',
          'Activa las notificaciones en los Ajustes de tu iPhone para recibir recordatorios.'
        )
      }
    }
    setAdvanceReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleToggleClassReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        Alert.alert(
          'Permiso de Notificaciones',
          'Activa las notificaciones en los Ajustes de tu iPhone para recibir avisos de clase.'
        )
      }
    }
    setClassReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, class_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleOpenTimeModal = () => {
    triggerHaptic('light')
    setShowTimeModal(true)
    Animated.parallel([
      Animated.timing(timeFadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(timeSlideAnim, { toValue: 0, stiffness: 450, damping: 28, useNativeDriver: true }),
    ]).start()
  }

  const handleCloseTimeModal = () => {
    triggerHaptic('light')
    Animated.parallel([
      Animated.timing(timeFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(timeSlideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setShowTimeModal(false)
    })
  }

  const handleSelectHour = async (timeStr: string) => {
    triggerHaptic('selection')
    setAdvanceReminderTime(timeStr)
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_time: timeStr }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
    handleCloseTimeModal()
  }

  const handleUpdateSemesterDate = async (
    target: 'fall_start' | 'fall_end' | 'spring_start' | 'spring_end' | null,
    selectedDate: Date
  ) => {
    if (!target) return
    const dateKey = formatDateToKey(selectedDate)
    triggerHaptic('selection')

    const current = await personalStorage.getPreferences()
    const updated = { ...current }

    if (target === 'fall_start') {
      setFallStart(dateKey)
      updated.semester_fall_start = dateKey
    } else if (target === 'fall_end') {
      setFallEnd(dateKey)
      updated.semester_fall_end = dateKey
    } else if (target === 'spring_start') {
      setSpringStart(dateKey)
      updated.semester_spring_start = dateKey
    } else if (target === 'spring_end') {
      setSpringEnd(dateKey)
      updated.semester_spring_end = dateKey
    }

    await personalStorage.setPreferences(updated)
  }

  const handleResetSemesterDates = async () => {
    triggerHaptic('medium')
    const defaultFallStart = `${currentYear}-08-01`
    const defaultFallEnd = `${currentYear}-12-31`
    const defaultSpringStart = `${currentYear}-02-01`
    const defaultSpringEnd = `${currentYear}-06-30`

    setFallStart(defaultFallStart)
    setFallEnd(defaultFallEnd)
    setSpringStart(defaultSpringStart)
    setSpringEnd(defaultSpringEnd)
    setActiveDatePicker(null)

    const current = await personalStorage.getPreferences()
    const updated = {
      ...current,
      semester_fall_start: defaultFallStart,
      semester_fall_end: defaultFallEnd,
      semester_spring_start: defaultSpringStart,
      semester_spring_end: defaultSpringEnd,
    }
    await personalStorage.setPreferences(updated)
  }

  const handleClearAllData = () => {
    triggerHaptic('warning')
    Alert.alert(
      'Restablecer App',
      '¿Deseas eliminar todas las materias, horarios y tareas del dispositivo? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer Todo',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('error')
            await clearData()
            loadData()
            handleCloseSettings()
            Alert.alert('Restablecido', 'La app ha quedado limpia como en su primer uso.')
          },
        },
      ]
    )
  }

  const formatTimeDisplay = (timeStr: string) => {
    const found = PRESET_HOURS.find((p) => p.time === timeStr)
    if (found) return found.label
    try {
      const [h, m] = timeStr.split(':')
      const hour = parseInt(h, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const formatted = hour % 12 || 12
      return `${formatted}:${m} ${ampm}`
    } catch {
      return timeStr
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return 'E'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Principal con Botón de Tuerca (Settings) */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.title}>Perfil</Text>
              <Text style={styles.subtitle}>Estadísticas y cuenta</Text>
            </View>

            <Pressable
              onPress={handleOpenSettings}
              hitSlop={10}
              style={({ pressed }) => [styles.gearBtn, pressed && styles.rowPressed]}
            >
              <SettingsIcon size={18} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {/* Hero Profile Abierto y Sofisticado */}
        <Pressable
          onPress={handleOpenEditProfile}
          style={({ pressed }) => [styles.heroProfileRow, pressed && styles.rowPressed]}
        >
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{getInitials(profile?.full_name)}</Text>
          </View>

          <View style={styles.heroProfileInfo}>
            <View style={styles.nameWithEditRow}>
              <Text style={styles.heroProfileName} numberOfLines={1}>
                {profile?.full_name || 'Estudiante'}
              </Text>
              <Edit3 size={14} color="#71717A" />
            </View>
            <Text style={styles.heroProfileSubtitle}>Toca para editar tu nombre</Text>
          </View>
        </Pressable>

        {/* Métricas Vitales Académicas */}
        <MinimalistVitalStats />

        {/* Mapa de Actividad Estilo GitHub */}
        <MinimalistActivityHeatmap />

        {/* Gráfica de Distribución de Carga / Balance de Materias Expandida */}
        <MinimalistSubjectBalance />
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL: AJUSTES DEL SISTEMA (BOTTOM SHEET ESTILO APPLE)                     */}
      {/* ========================================================================= */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseSettings}
      >
        <View style={styles.modalBackdrop}>
          {/* Backdrop con Fade */}
          <Animated.View style={[styles.backdropTouch, { opacity: settingsFadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSettings} />
          </Animated.View>

          {/* Hoja Deslizante con PanResponder */}
          <Animated.View
            style={[
              styles.settingsSheetContainer,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 16,
                transform: [
                  { translateY: settingsSlideAnim },
                  { translateY: settingsPanY },
                ],
              },
            ]}
          >
            {/* Tirador Superior y Cabecera del Modal con gesto PanResponder */}
            <View {...settingsPanResponder.panHandlers}>
              <View style={styles.dragHandle} />

              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.modalTitle}>Ajustes del Sistema</Text>
                  <Text style={styles.modalSubtitle}>Preferencias de la aplicación</Text>
                </View>
                <Pressable onPress={handleCloseSettings} hitSlop={12} style={styles.modalCloseBtn}>
                  <X size={18} color="#A1A1AA" />
                </Pressable>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsSheetScroll}>
              {/* Sección: Recordatorios Automáticos */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionHeaderTitle}>Recordatorios Automáticos</Text>

                {/* Aviso de Entregas */}
                <View style={styles.itemRow}>
                  <Bell size={18} color="#A1A1AA" style={styles.itemIcon} />
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>Aviso de entregas</Text>
                    <Text style={styles.itemSubtitle}>Notificar la noche anterior a la hora elegida</Text>
                  </View>
                  <Switch
                    value={advanceReminderEnabled}
                    onValueChange={handleToggleAdvanceReminder}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={advanceReminderEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>

                {/* Selector de Hora */}
                {advanceReminderEnabled && (
                  <>
                    <View style={styles.hairlineDivider} />
                    <Pressable
                      onPress={handleOpenTimeModal}
                      style={({ pressed }) => [styles.itemRowPressable, pressed && styles.rowPressed]}
                    >
                      <Clock size={18} color="#A1A1AA" style={styles.itemIcon} />
                      <View style={styles.itemContent}>
                        <Text style={styles.itemTitle}>Hora del recordatorio</Text>
                        <Text style={styles.itemSubtitle}>Momento del aviso previo a la entrega</Text>
                      </View>
                      <View style={styles.timeValueRow}>
                        <Text style={styles.timeValueText}>
                          {formatTimeDisplay(advanceReminderTime)}
                        </Text>
                        <ChevronRight size={14} color="#71717A" />
                      </View>
                    </Pressable>
                  </>
                )}

                <View style={styles.hairlineDivider} />

                {/* Aviso de Próxima Clase */}
                <View style={styles.itemRow}>
                  <BookOpen size={18} color="#A1A1AA" style={styles.itemIcon} />
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>Aviso de próxima clase</Text>
                    <Text style={styles.itemSubtitle}>10 min antes con el nombre de la materia</Text>
                  </View>
                  <Switch
                    value={classReminderEnabled}
                    onValueChange={handleToggleClassReminder}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={classReminderEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* Sección: Periodos de Semestre */}
              <View style={styles.settingsSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Periodos de Semestre</Text>
                  <Pressable
                    onPress={handleResetSemesterDates}
                    hitSlop={8}
                    style={({ pressed }) => [styles.resetPresetBtn, pressed && styles.rowPressed]}
                  >
                    <RotateCcw size={11} color="#71717A" />
                    <Text style={styles.resetPresetText}>Restablecer</Text>
                  </Pressable>
                </View>

                {/* Semestre Otoño (Ago - Dic) */}
                <View style={styles.semesterConfigBox}>
                  <View style={styles.semesterTitleRow}>
                    <Calendar size={14} color="#FF6B00" />
                    <Text style={styles.semesterBoxTitle}>Otoño (Agosto - Diciembre)</Text>
                  </View>

                  <View style={styles.datesPillsRow}>
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        setActiveDatePicker(activeDatePicker === 'fall_start' ? null : 'fall_start')
                      }}
                      style={[
                        styles.datePillBtn,
                        activeDatePicker === 'fall_start' && styles.datePillBtnActive,
                      ]}
                    >
                      <Text style={styles.datePillLabel}>Inicio</Text>
                      <Text style={styles.datePillValue}>{formatReadableDate(fallStart, '01 Ago')}</Text>
                    </Pressable>

                    <Text style={styles.datePillArrow}>→</Text>

                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        setActiveDatePicker(activeDatePicker === 'fall_end' ? null : 'fall_end')
                      }}
                      style={[
                        styles.datePillBtn,
                        activeDatePicker === 'fall_end' && styles.datePillBtnActive,
                      ]}
                    >
                      <Text style={styles.datePillLabel}>Fin</Text>
                      <Text style={styles.datePillValue}>{formatReadableDate(fallEnd, '31 Dic')}</Text>
                    </Pressable>
                  </View>

                  {/* Inline Date Picker si está activo para Otoño */}
                  {(activeDatePicker === 'fall_start' || activeDatePicker === 'fall_end') && (
                    <View style={styles.inlinePickerContainer}>
                      <Text style={styles.inlinePickerHeader}>
                        {activeDatePicker === 'fall_start'
                          ? 'Fecha de Inicio (Otoño)'
                          : 'Fecha de Fin (Otoño)'}
                      </Text>
                      <DateTimePicker
                        value={parseDateString(
                          activeDatePicker === 'fall_start' ? fallStart : fallEnd,
                          currentYear,
                          activeDatePicker === 'fall_start' ? 7 : 11,
                          activeDatePicker === 'fall_start' ? 1 : 31
                        )}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        themeVariant="dark"
                        locale="es-ES"
                        onChange={(_: DateTimePickerEvent, d?: Date) => {
                          if (d) {
                            handleUpdateSemesterDate(activeDatePicker, d)
                            if (Platform.OS === 'android') setActiveDatePicker(null)
                          }
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Semestre Primavera (Feb - Jun) */}
                <View style={styles.semesterConfigBox}>
                  <View style={styles.semesterTitleRow}>
                    <Calendar size={14} color="#34D399" />
                    <Text style={styles.semesterBoxTitle}>Primavera (Febrero - Junio)</Text>
                  </View>

                  <View style={styles.datesPillsRow}>
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        setActiveDatePicker(activeDatePicker === 'spring_start' ? null : 'spring_start')
                      }}
                      style={[
                        styles.datePillBtn,
                        activeDatePicker === 'spring_start' && styles.datePillBtnActive,
                      ]}
                    >
                      <Text style={styles.datePillLabel}>Inicio</Text>
                      <Text style={styles.datePillValue}>{formatReadableDate(springStart, '01 Feb')}</Text>
                    </Pressable>

                    <Text style={styles.datePillArrow}>→</Text>

                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        setActiveDatePicker(activeDatePicker === 'spring_end' ? null : 'spring_end')
                      }}
                      style={[
                        styles.datePillBtn,
                        activeDatePicker === 'spring_end' && styles.datePillBtnActive,
                      ]}
                    >
                      <Text style={styles.datePillLabel}>Fin</Text>
                      <Text style={styles.datePillValue}>{formatReadableDate(springEnd, '30 Jun')}</Text>
                    </Pressable>
                  </View>

                  {/* Inline Date Picker si está activo para Primavera */}
                  {(activeDatePicker === 'spring_start' || activeDatePicker === 'spring_end') && (
                    <View style={styles.inlinePickerContainer}>
                      <Text style={styles.inlinePickerHeader}>
                        {activeDatePicker === 'spring_start'
                          ? 'Fecha de Inicio (Primavera)'
                          : 'Fecha de Fin (Primavera)'}
                      </Text>
                      <DateTimePicker
                        value={parseDateString(
                          activeDatePicker === 'spring_start' ? springStart : springEnd,
                          currentYear,
                          activeDatePicker === 'spring_start' ? 1 : 5,
                          activeDatePicker === 'spring_start' ? 1 : 30
                        )}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        themeVariant="dark"
                        locale="es-ES"
                        onChange={(_: DateTimePickerEvent, d?: Date) => {
                          if (d) {
                            handleUpdateSemesterDate(activeDatePicker, d)
                            if (Platform.OS === 'android') setActiveDatePicker(null)
                          }
                        }}
                      />
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* Sección: Experiencia y Respuesta */}
              <View style={styles.settingsSection}>
                <Text style={styles.sectionHeaderTitle}>Experiencia y Respuesta</Text>

                {/* Respuesta Háptica */}
                <View style={styles.itemRow}>
                  <Smartphone size={18} color="#A1A1AA" style={styles.itemIcon} />
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>Vibración háptica</Text>
                    <Text style={styles.itemSubtitle}>Retroalimentación táctil nativa</Text>
                  </View>
                  <Switch
                    value={hapticsEnabled}
                    onValueChange={handleToggleHaptics}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={hapticsEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>

                <View style={styles.hairlineDivider} />

                {/* Animación Festiva */}
                <View style={styles.itemRow}>
                  <Sparkles size={18} color="#A1A1AA" style={styles.itemIcon} />
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>Animación festiva</Text>
                    <Text style={styles.itemSubtitle}>Confetti al completar entregas</Text>
                  </View>
                  <Switch
                    value={confettiEnabled}
                    onValueChange={handleToggleConfetti}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={confettiEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>
              </View>

              <View style={styles.sectionDivider} />

              {/* Restablecer Datos */}
              <Pressable
                onPress={handleClearAllData}
                style={({ pressed }) => [styles.clearRow, pressed && styles.rowPressed]}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text style={styles.clearBtnText}>Restablecer Datos Locales</Text>
              </Pressable>

              <Text style={styles.versionText}>Synapse v2.0</Text>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: SELECCIÓN DE HORA DE RECORDATORIO                                  */}
      {/* ========================================================================= */}
      <Modal visible={showTimeModal} transparent animationType="none" onRequestClose={handleCloseTimeModal}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.backdropTouch, { opacity: timeFadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseTimeModal} />
          </Animated.View>

          <Animated.View
            style={[
              styles.timeSheetContainer,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 12,
                transform: [{ translateY: timeSlideAnim }],
              },
            ]}
          >
            <View style={styles.dragHandle} />
            <View style={styles.timeSheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Hora del Recordatorio</Text>
                <Text style={styles.modalSubtitle}>Aviso previo la noche antes de la entrega</Text>
              </View>
              <Pressable onPress={handleCloseTimeModal} hitSlop={12} style={styles.modalCloseBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>

            <View style={styles.hoursList}>
              {PRESET_HOURS.map((preset) => {
                const isSelected = advanceReminderTime === preset.time
                return (
                  <Pressable
                    key={preset.time}
                    onPress={() => handleSelectHour(preset.time)}
                    style={[styles.hourItem, isSelected && styles.hourItemSelected]}
                  >
                    <View>
                      <Text style={[styles.hourItemText, isSelected && styles.hourItemTextSelected]}>
                        {preset.label}
                      </Text>
                      <Text style={styles.hourItemDesc}>{preset.desc}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedCheck}>
                        <Check size={14} color="#09090B" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDICIÓN DE PERFIL                                                  */}
      {/* ========================================================================= */}
      <Modal visible={showEditProfileModal} transparent animationType="none" onRequestClose={handleCloseEditProfile}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.backdropTouch, { opacity: editFadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseEditProfile} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetContainer,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 16,
                transform: [{ translateY: editSlideAnim }, { translateY: keyboardTranslateY }],
              },
            ]}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Editar Nombre</Text>
                <Text style={styles.modalSubtitle}>Cómo te saluda Synapse</Text>
              </View>
              <Pressable onPress={handleCloseEditProfile} hitSlop={12} style={styles.modalCloseBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOMBRE</Text>
              <TextInput
                ref={nameInputRef}
                value={editName}
                onChangeText={setEditName}
                placeholder="Tu nombre"
                placeholderTextColor="#52525B"
                style={styles.textInput}
                returnKeyType="done"
                onSubmitEditing={handleSaveProfile}
              />
            </View>

            <Pressable
              onPress={handleSaveProfile}
              disabled={savingProfile}
              style={styles.saveBtn}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <>
                  <Check size={16} color="#09090B" strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 18,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#18181B',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  heroAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  heroProfileInfo: {
    flex: 1,
    gap: 3,
  },
  nameWithEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroProfileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroProfileSubtitle: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  settingsSheetContainer: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  settingsSheetScroll: {
    marginTop: 10,
  },
  settingsSection: {
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  resetPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: '#18181B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  resetPresetText: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '600',
  },
  semesterConfigBox: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 12,
    marginBottom: 8,
  },
  semesterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  semesterBoxTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  datesPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePillBtn: {
    flex: 1,
    backgroundColor: '#222226',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E33',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  datePillBtnActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  datePillLabel: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  datePillValue: {
    color: '#FAFAFA',
    fontSize: 13,
    fontWeight: '700',
  },
  datePillArrow: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '600',
  },
  inlinePickerContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    alignItems: 'center',
  },
  inlinePickerHeader: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 14,
  },
  itemRowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 14,
  },
  rowPressed: {
    opacity: 0.7,
  },
  itemIcon: {
    opacity: 0.85,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  itemSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 1.5,
    fontWeight: '400',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 32,
  },
  timeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeValueText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '500',
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginTop: 6,
  },
  clearBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
  },
  versionText: {
    color: '#3F3F46',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  timeSheetContainer: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  timeSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  hoursList: {
    gap: 8,
  },
  hourItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  hourItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: '#FFFFFF',
  },
  hourItemText: {
    color: '#E4E4E7',
    fontSize: 14.5,
    fontWeight: '600',
  },
  hourItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hourItemDesc: {
    color: '#71717A',
    fontSize: 11.5,
    marginTop: 1,
  },
  selectedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContainer: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: '#18181B',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 14.5,
    fontWeight: '700',
  },
})
