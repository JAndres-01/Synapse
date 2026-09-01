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
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/personalSupabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  User,
  LogOut,
  ShieldCheck,
  BookOpen,
  CheckSquare,
  Cloud,
  Sparkles,
  Smartphone,
  RefreshCw,
  Edit3,
  Moon,
  ChevronRight,
  X,
  Check,
} from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useRouter, useFocusEffect } from 'expo-router'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile, signOut, refreshProfile } = usePersonalAuth()

  const [subjectsCount, setSubjectsCount] = useState(0)
  const [tasksCount, setTasksCount] = useState(0)
  const [completedTasksCount, setCompletedTasksCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('Ahora mismo')

  // Preferencias
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)

  // Modal de Edición de Perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editName, setEditName] = useState(profile?.full_name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(300)).current

  const loadData = useCallback(async () => {
    const [s, t] = await Promise.all([
      personalStorage.getSubjects(),
      personalStorage.getTasks(),
    ])
    setSubjectsCount(s.length)
    setTasksCount(t.length)
    setCompletedTasksCount(t.filter((task) => task.status === 'completed').length)
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
      }
      await loadData()
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const mins = now.getMinutes().toString().padStart(2, '0')
      setLastSyncTime(`${hours}:${mins}`)
      triggerHaptic('success')
      Alert.alert('Sincronización Exitosa', 'Tus datos locales y remotos están completamente sincronizados.')
    } catch (err: any) {
      triggerHaptic('error')
      Alert.alert('Error de Sincronización', err.message || 'No se pudo sincronizar con la nube.')
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
      Alert.alert('Nombre Requerido', 'Por favor ingresa un nombre válido.')
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

  const handleSignOut = () => {
    triggerHaptic('warning')
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta en este dispositivo?',
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

  const completionRate = tasksCount > 0 ? Math.round((completedTasksCount / tasksCount) * 100) : 100

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
        {/* Header Principal */}
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
          <Text style={styles.subtitle}>Preferencias, cuenta y estado de sincronización</Text>
        </View>

        {/* Tarjeta de Perfil */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.full_name || 'E').slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {profile?.full_name || 'Estudiante'}
                </Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Cuenta Activa</Text>
                </View>
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>
                {profile?.email || user?.email || 'Sin correo asignado'}
              </Text>
            </View>

            <Pressable
              onPress={handleOpenEditProfile}
              style={styles.editProfileBtn}
              hitSlop={8}
            >
              <Edit3 size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Resumen y Métricas Académicas */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeaderTitle}>MÉTRICAS ACADÉMICAS</Text>

          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <BookOpen size={16} color="#FFFFFF" />
                <Text style={styles.statNumber}>{subjectsCount}</Text>
                <Text style={styles.statLabel}>Materias</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <CheckSquare size={16} color="#FFFFFF" />
                <Text style={styles.statNumber}>
                  {completedTasksCount}/{tasksCount}
                </Text>
                <Text style={styles.statLabel}>Entregadas</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <ShieldCheck size={16} color="#FFFFFF" />
                <Text style={styles.statNumber}>{completionRate}%</Text>
                <Text style={styles.statLabel}>Efectividad</Text>
              </View>
            </View>

            {/* Barra de progreso de entregas */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
            </View>
          </View>
        </View>

        {/* Preferencias de Experiencia */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeaderTitle}>PREFERENCIAS DE LA APP</Text>

          <View style={styles.groupCard}>
            {/* Vibración Háptica */}
            <View style={styles.groupItem}>
              <View style={styles.groupItemLeft}>
                <Smartphone size={16} color="#A1A1AA" />
                <View>
                  <Text style={styles.itemTitle}>Respuesta Háptica</Text>
                  <Text style={styles.itemSubtitle}>Vibración táctil al interactuar</Text>
                </View>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection')
                  setHapticsEnabled(val)
                }}
                trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                thumbColor={hapticsEnabled ? '#09090B' : '#71717A'}
              />
            </View>

            <View style={styles.itemDivider} />

            {/* Animación de Confetti */}
            <View style={styles.groupItem}>
              <View style={styles.groupItemLeft}>
                <Sparkles size={16} color="#A1A1AA" />
                <View>
                  <Text style={styles.itemTitle}>Celebración al Completar</Text>
                  <Text style={styles.itemSubtitle}>Lluvia de partículas al finalizar tareas</Text>
                </View>
              </View>
              <Switch
                value={confettiEnabled}
                onValueChange={(val) => {
                  triggerHaptic('selection')
                  setConfettiEnabled(val)
                }}
                trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                thumbColor={confettiEnabled ? '#09090B' : '#71717A'}
              />
            </View>

            <View style={styles.itemDivider} />

            {/* Modo Oscuro */}
            <View style={styles.groupItem}>
              <View style={styles.groupItemLeft}>
                <Moon size={16} color="#A1A1AA" />
                <View>
                  <Text style={styles.itemTitle}>Tema Visual</Text>
                  <Text style={styles.itemSubtitle}>Dark OLED puro de alto contraste</Text>
                </View>
              </View>
              <View style={styles.themeTag}>
                <Text style={styles.themeTagText}>OLED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Nube y Sincronización */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeaderTitle}>ALMACENAMIENTO Y NUBE</Text>

          <View style={styles.groupCard}>
            <View style={styles.syncCardContent}>
              <View style={styles.syncTop}>
                <View style={styles.syncBadge}>
                  <View style={styles.syncDot} />
                  <Text style={styles.syncBadgeText}>Sincronización Offline-First</Text>
                </View>
                <Text style={styles.syncTimeText}>Última: {lastSyncTime}</Text>
              </View>

              <Text style={styles.syncDescription}>
                Tus materias, horarios y tareas se guardan de forma instantánea en tu dispositivo y se respaldan de forma segura en la base de datos de Supabase.
              </Text>

              <Pressable
                onPress={handleManualSync}
                disabled={syncing}
                style={[styles.manualSyncBtn, syncing && styles.manualSyncBtnDisabled]}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <RefreshCw size={13} color="#09090B" />
                    <Text style={styles.manualSyncBtnText}>Sincronizar Ahora</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Información y Versión */}
        <View style={styles.appInfoCard}>
          <Text style={styles.appInfoName}>Synapse Personal</Text>
          <Text style={styles.appInfoVersion}>Versión 2.0.0 • Entorno Expo & React Native</Text>
        </View>

        {/* Botón de Cerrar Sesión */}
        <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
          <LogOut size={15} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </Pressable>
      </ScrollView>

      {/* Modal de Editar Perfil */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseEditProfile}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
            <Pressable style={styles.modalBackdropTouch} onPress={handleCloseEditProfile} />
          </Animated.View>

          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>
              <Pressable onPress={handleCloseEditProfile} hitSlop={10} style={styles.modalCloseBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
              <View style={styles.inputWrapper}>
                <User size={16} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Tu nombre completo"
                  placeholderTextColor="#71717A"
                  style={styles.modalTextInput}
                  autoFocus={true}
                />
              </View>

              <Pressable
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={[styles.saveProfileBtn, savingProfile && styles.saveProfileBtnDisabled]}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <Check size={16} color="#09090B" strokeWidth={3} />
                    <Text style={styles.saveProfileBtnText}>Guardar Cambios</Text>
                  </>
                )}
              </Pressable>
            </View>
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
    gap: 16,
  },
  header: {
    paddingHorizontal: 2,
    gap: 2,
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
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: '#101014',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#09090B',
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  activeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#A1A1AA',
    fontSize: 9.5,
    fontWeight: '700',
  },
  userEmail: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  editProfileBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 8.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  statsCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  groupCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  groupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  itemSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  themeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  themeTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  syncCardContent: {
    paddingVertical: 16,
    gap: 10,
  },
  syncTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: '#10B981',
  },
  syncBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  syncTimeText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  syncDescription: {
    color: '#71717A',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  manualSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  manualSyncBtnDisabled: {
    opacity: 0.6,
  },
  manualSyncBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '800',
  },
  appInfoCard: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  appInfoName: {
    color: '#52525B',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  appInfoVersion: {
    color: '#3F3F46',
    fontSize: 10.5,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 14,
    paddingVertical: 12.5,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalBackdropTouch: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#0F0F13',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 12,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  inputIcon: {
    marginRight: 2,
  },
  modalTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
  },
  saveProfileBtnDisabled: {
    opacity: 0.6,
  },
  saveProfileBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '800',
  },
})
