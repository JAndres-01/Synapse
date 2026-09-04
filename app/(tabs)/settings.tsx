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
} from 'lucide-react-native'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import {
  syncAllNotifications,
  requestNotificationPermissions,
  sendTestNotification,
} from '@/lib/personalNotifications'
import { useRouter, useFocusEffect } from 'expo-router'

const PRESET_HOURS = [
  { time: '18:00', label: '6:00 PM', desc: 'Tarde' },
  { time: '19:00', label: '7:00 PM', desc: 'Atardecer' },
  { time: '20:00', label: '8:00 PM', desc: 'Noche (Recomendado)' },
  { time: '21:00', label: '9:00 PM', desc: 'Noche' },
  { time: '22:00', label: '10:00 PM', desc: 'Antes de dormir' },
]

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, updateProfile, clearData } = usePersonalAuth()

  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
  const [advanceReminderEnabled, setAdvanceReminderEnabled] = useState(true)
  const [advanceReminderTime, setAdvanceReminderTime] = useState('20:00')
  const [classReminderEnabled, setClassReminderEnabled] = useState(true)

  // Modal de Selección de Hora de Recordatorio
  const [showTimeModal, setShowTimeModal] = useState(false)
  const timeFadeAnim = useRef(new Animated.Value(0)).current
  const timeSlideAnim = useRef(new Animated.Value(300)).current

  // Modal de Edición de Perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editName, setEditName] = useState(profile?.full_name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const nameInputRef = useRef<TextInput>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(300)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current

  // Sincronización instantánea a 120Hz con el teclado de iOS (igual que MinimalistTaskModal)
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
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenEditProfile = () => {
    triggerHaptic('light')
    setEditName(profile?.full_name || '')
    setShowEditProfileModal(true)
    slideAnim.setValue(300)
    fadeAnim.setValue(0)
    keyboardTranslateY.setValue(0)

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, easing: APPLE_EASING, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: APPLE_EASING, useNativeDriver: true }),
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
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
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

  const handleSendTestNotification = async () => {
    triggerHaptic('medium')
    const success = await sendTestNotification()
    if (success) {
      triggerHaptic('success')
      Alert.alert(
        'Notificación enviada',
        'Se ha enviado una notificación de prueba. En 1 segundo verás el banner en tu pantalla.'
      )
    } else {
      triggerHaptic('error')
      Alert.alert(
        'Permiso denegado',
        'Por favor activa los permisos de notificación en los Ajustes del sistema para recibir avisos.'
      )
    }
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
    if (!name) return 'U'
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
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
          <Text style={styles.subtitle}>Preferencias del sistema</Text>
        </View>

        {/* Perfil Minimalista Abierto (Sin Card) */}
        <Pressable
          onPress={handleOpenEditProfile}
          style={({ pressed }) => [styles.profileRow, pressed && styles.rowPressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile?.full_name)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameWithEditRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.full_name || 'Estudiante'}
              </Text>
              <Edit3 size={13} color="#71717A" />
            </View>
            <Text style={styles.profileSubtitle}>Toca para cambiar tu nombre</Text>
          </View>
          <ChevronRight size={16} color="#52525B" />
        </Pressable>

        {/* Separador de Sección */}
        <View style={styles.sectionDivider} />

        {/* Sección: Recordatorios Automáticos (Abierta, Sin Cards) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recordatorios Automáticos</Text>

          {/* Aviso de Entregas */}
          <View style={styles.itemRow}>
            <Bell size={18} color="#A1A1AA" style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Aviso de entregas</Text>
              <Text style={styles.itemSubtitle}>Notificar el día anterior a la hora elegida</Text>
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

          <View style={styles.hairlineDivider} />

          {/* Probar Notificaciones */}
          <Pressable
            onPress={handleSendTestNotification}
            style={({ pressed }) => [styles.itemRowPressable, pressed && styles.rowPressed]}
          >
            <Bell size={18} color="#A1A1AA" style={styles.itemIcon} />
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Probar notificaciones</Text>
              <Text style={styles.itemSubtitle}>Envía un aviso de prueba a tu pantalla</Text>
            </View>
            <Text style={styles.actionLinkText}>Probar</Text>
          </Pressable>
        </View>

        {/* Separador de Sección */}
        <View style={styles.sectionDivider} />

        {/* Sección: Experiencia y Respuesta (Abierta, Sin Cards) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Experiencia y Respuesta</Text>

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

        {/* Separador de Sección */}
        <View style={styles.sectionDivider} />

        {/* Restablecer Datos (Abierto y Limpio) */}
        <Pressable
          onPress={handleClearAllData}
          style={({ pressed }) => [styles.clearRow, pressed && styles.rowPressed]}
        >
          <Trash2 size={16} color="#EF4444" />
          <Text style={styles.clearBtnText}>Restablecer Datos</Text>
        </Pressable>

        {/* Versión */}
        <Text style={styles.versionText}>Synapse v2.0</Text>
      </ScrollView>

      {/* Modal de Selección de Hora de Recordatorio */}
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
                    style={[styles.hourRow, isSelected && styles.hourRowSelected]}
                  >
                    <View style={styles.hourInfo}>
                      <Text style={[styles.hourLabel, isSelected && styles.hourLabelSelected]}>
                        {preset.label}
                      </Text>
                      <Text style={styles.hourDesc}>{preset.desc}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.hourCheckPill}>
                        <Check size={14} color="#09090B" />
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Edición de Perfil con sincronización nativa ultra rápida (igual que MinimalistTaskModal) */}
      <Modal visible={showEditProfileModal} transparent animationType="none" onRequestClose={handleCloseEditProfile}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.backdropTouch, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseEditProfile} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetContainer,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 16,
                transform: [{ translateY: slideAnim }, { translateY: keyboardTranslateY }],
              },
            ]}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Editar Nombre</Text>
                <Text style={styles.modalSubtitle}>Cómo te saluda la app</Text>
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
                  <Check size={16} color="#09090B" />
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
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
    fontWeight: '500',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 14,
    borderRadius: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  nameWithEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  profileSubtitle: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  sectionContainer: {
    gap: 2,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  itemRowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionLinkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  clearBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    color: '#52525B',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 16,
  },
  timeSheetContainer: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
  hoursList: {
    gap: 8,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  hourRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderColor: '#FFFFFF',
  },
  hourInfo: {
    gap: 1,
  },
  hourLabel: {
    color: '#E4E4E7',
    fontSize: 15,
    fontWeight: '700',
  },
  hourLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  hourDesc: {
    color: '#71717A',
    fontSize: 11.5,
  },
  hourCheckPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
