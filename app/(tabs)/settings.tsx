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
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  User,
  LogOut,
  Sparkles,
  Smartphone,
  RefreshCw,
  Edit3,
  X,
  Check,
  ChevronRight,
  Bell,
  Clock,
  BookOpen,
} from 'lucide-react-native'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import {
  syncAllNotifications,
  requestNotificationPermissions,
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
  const { user, profile, signOut, refreshProfile } = usePersonalAuth()

  const [syncing, setSyncing] = useState(false)
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
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(300)).current

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

  const handleManualSync = async () => {
    triggerHaptic('medium')
    setSyncing(true)
    try {
      if (user?.id) {
        const [schedRes, taskRes, subjRes] = await Promise.all([
          supabase.from('schedules').select('*, subject:subjects(*)').eq('user_id', user.id),
          supabase.from('tasks').select('*, subject:subjects(*)').eq('user_id', user.id),
          supabase.from('subjects').select('*').eq('user_id', user.id),
        ])

        if (subjRes.data) await personalStorage.setSubjects(subjRes.data)
        if (schedRes.data) await personalStorage.setSchedules(schedRes.data)
        if (taskRes.data) await personalStorage.setTasks(taskRes.data)

        await syncAllNotifications(taskRes.data || undefined, schedRes.data || undefined)
      }
      triggerHaptic('success')
      Alert.alert('Sincronizado', 'Tus datos y recordatorios están actualizados.')
    } catch (err: any) {
      triggerHaptic('error')
      Alert.alert('Error', err.message || 'No se pudo sincronizar.')
    } finally {
      setSyncing(false)
    }
  }

  const handleOpenEditProfile = () => {
    triggerHaptic('light')
    setEditName(profile?.full_name || '')
    setShowEditProfileModal(true)
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, stiffness: 450, damping: 28, useNativeDriver: true }),
    ]).start()
  }

  const handleCloseEditProfile = () => {
    triggerHaptic('light')
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
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
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ full_name: editName.trim() })
          .eq('id', user.id)
      }
      if (refreshProfile) {
        await refreshProfile()
      }
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

  const handleSignOut = () => {
    triggerHaptic('warning')
    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('error')
            await signOut()
            router.replace('/auth')
          },
        },
      ]
    )
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
          <Text style={styles.subtitle}>Preferencias y cuenta personal</Text>
        </View>

        {/* Tarjeta de Perfil Compacta */}
        <Pressable onPress={handleOpenEditProfile} style={styles.profileCard}>
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
            <Text style={styles.profileEmail} numberOfLines={1}>
              {profile?.email || user?.email || 'Sin correo vinculado'}
            </Text>
          </View>
          <ChevronRight size={16} color="#52525B" />
        </Pressable>

        {/* Sección de Recordatorios Automáticos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recordatorios Automáticos</Text>
        </View>

        <View style={styles.groupCard}>
          {/* Recordatorio de Entregas (1 Día Antes) */}
          <View style={styles.groupRow}>
            <View style={styles.rowIconContainer}>
              <Bell size={16} color="#FFFFFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Aviso de entregas</Text>
              <Text style={styles.rowSubtitle}>Notificar el día anterior a la hora elegida</Text>
            </View>
            <Switch
              value={advanceReminderEnabled}
              onValueChange={handleToggleAdvanceReminder}
              trackColor={{ false: '#27272A', true: '#FFFFFF' }}
              thumbColor={advanceReminderEnabled ? '#09090B' : '#71717A'}
              ios_backgroundColor="#27272A"
            />
          </View>

          {/* Selector de Hora para el Recordatorio de Entregas */}
          {advanceReminderEnabled && (
            <>
              <View style={styles.rowDivider} />
              <Pressable
                onPress={handleOpenTimeModal}
                style={styles.groupRow}
              >
                <View style={styles.rowIconContainer}>
                  <Clock size={16} color="#A1A1AA" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Hora del recordatorio</Text>
                  <Text style={styles.rowSubtitle}>Momento del aviso previo a la entrega</Text>
                </View>
                <View style={styles.timeValuePill}>
                  <Text style={styles.timeValueText}>
                    {formatTimeDisplay(advanceReminderTime)}
                  </Text>
                  <ChevronRight size={13} color="#71717A" />
                </View>
              </Pressable>
            </>
          )}

          <View style={styles.rowDivider} />

          {/* Aviso de Próxima Clase */}
          <View style={styles.groupRow}>
            <View style={styles.rowIconContainer}>
              <BookOpen size={16} color="#FFFFFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Aviso de próxima clase</Text>
              <Text style={styles.rowSubtitle}>10 min antes con aula y materia</Text>
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

        {/* Sección de Experiencia */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Experiencia y Respuesta</Text>
        </View>

        <View style={styles.groupCard}>
          {/* Respuesta Háptica */}
          <View style={styles.groupRow}>
            <View style={styles.rowIconContainer}>
              <Smartphone size={16} color="#FFFFFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Vibración háptica</Text>
              <Text style={styles.rowSubtitle}>Retroalimentación táctil de iOS</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: '#27272A', true: '#FFFFFF' }}
              thumbColor={hapticsEnabled ? '#09090B' : '#71717A'}
              ios_backgroundColor="#27272A"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Confetti al Completar Tareas */}
          <View style={styles.groupRow}>
            <View style={styles.rowIconContainer}>
              <Sparkles size={16} color="#FFFFFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Animación festiva</Text>
              <Text style={styles.rowSubtitle}>Confetti al completar entregas</Text>
            </View>
            <Switch
              value={confettiEnabled}
              onValueChange={handleToggleConfetti}
              trackColor={{ false: '#27272A', true: '#FFFFFF' }}
              thumbColor={confettiEnabled ? '#09090B' : '#71717A'}
              ios_backgroundColor="#27272A"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Sincronización Manual */}
          <Pressable
            onPress={handleManualSync}
            disabled={syncing}
            style={styles.groupRow}
          >
            <View style={styles.rowIconContainer}>
              <RefreshCw
                size={16}
                color="#FFFFFF"
                style={syncing ? { transform: [{ rotate: '45deg' }] } : undefined}
              />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Sincronizar ahora</Text>
              <Text style={styles.rowSubtitle}>
                {syncing ? 'Sincronizando...' : 'Actualizar nube y recordatorios'}
              </Text>
            </View>
            {syncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ChevronRight size={16} color="#52525B" />
            )}
          </Pressable>
        </View>

        {/* Botón de Cerrar Sesión */}
        <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={16} color="#EF4444" />
          <Text style={styles.signOutText}>Cerrar Sesión</Text>
        </Pressable>

        {/* Versión */}
        <Text style={styles.versionText}>Synapse v2.0 • Offline-First Native</Text>
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
              {PRESET_HOURS.map((item) => {
                const isSelected = advanceReminderTime === item.time
                return (
                  <Pressable
                    key={item.time}
                    onPress={() => handleSelectHour(item.time)}
                    style={[styles.hourRow, isSelected && styles.hourRowActive]}
                  >
                    <View style={styles.hourRowLeft}>
                      <Clock size={15} color={isSelected ? '#09090B' : '#71717A'} />
                      <View>
                        <Text style={[styles.hourLabel, isSelected && styles.hourLabelActive]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.hourDesc, isSelected && styles.hourDescActive]}>
                          {item.desc}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <Check size={16} color="#09090B" strokeWidth={3} />}
                  </Pressable>
                )
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Edición de Perfil Elevado */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseEditProfile}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Animated.View style={[styles.backdropTouch, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseEditProfile} />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalSheetContainer,
              {
                paddingBottom: Math.max(insets.bottom, 20) + 12,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Nombre</Text>
              <Pressable onPress={handleCloseEditProfile} hitSlop={12} style={styles.modalCloseBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Tu nombre"
                placeholderTextColor="#52525B"
                style={styles.textInput}
                autoFocus
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSaveProfile}
              />

              <Pressable
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={styles.saveProfileBtn}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <Check size={16} color="#09090B" strokeWidth={2.5} />
                    <Text style={styles.saveProfileBtnText}>Guardar Cambios</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
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
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#09090B',
    fontSize: 16,
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
    fontSize: 15.5,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeader: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
  },
  timeValuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeValueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 58,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 14.5,
    fontWeight: '700',
  },
  versionText: {
    color: '#52525B',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalSheetContainer: {
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  timeSheetContainer: {
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  timeSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 12,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingVertical: 13,
    gap: 6,
    marginTop: 4,
  },
  saveProfileBtnText: {
    color: '#09090B',
    fontSize: 14.5,
    fontWeight: '800',
  },
  hoursList: {
    gap: 8,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  hourRowActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  hourRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hourLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hourLabelActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  hourDesc: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  hourDescActive: {
    color: '#52525B',
    fontWeight: '600',
  },
})
