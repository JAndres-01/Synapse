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
} from 'lucide-react-native'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import { useRouter, useFocusEffect } from 'expo-router'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile, signOut, refreshProfile } = usePersonalAuth()

  const [syncing, setSyncing] = useState(false)
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)

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
      }
      triggerHaptic('success')
      Alert.alert('Sincronizado', 'Tus datos están actualizados con la nube.')
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
    await personalStorage.setPreferences({
      haptics_enabled: val,
      confetti_enabled: confettiEnabled,
    })
  }

  const handleToggleConfetti = async (val: boolean) => {
    setConfettiEnabled(val)
    triggerHaptic('selection')
    await personalStorage.setPreferences({
      haptics_enabled: hapticsEnabled,
      confetti_enabled: val,
    })
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
        {/* Header Limpio */}
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
        </View>

        {/* Perfil Integrado */}
        <Pressable
          onPress={handleOpenEditProfile}
          style={styles.profileRow}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name || 'E').slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {profile?.full_name || 'Estudiante'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profile?.email || user?.email || 'Sin correo asignado'}
            </Text>
          </View>

          <View style={styles.editIconBadge}>
            <Edit3 size={14} color="#A1A1AA" />
          </View>
        </Pressable>

        {/* ÚNICA Tarjeta Agrupada de Preferencias y Acciones */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeaderTitle}>PREFERENCIAS</Text>

          <View style={styles.groupCard}>
            {/* Vibración Háptica */}
            <View style={styles.groupItem}>
              <View style={styles.groupItemLeft}>
                <Smartphone size={16} color="#A1A1AA" />
                <Text style={styles.itemTitle}>Respuesta Háptica</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                thumbColor={hapticsEnabled ? '#09090B' : '#71717A'}
              />
            </View>

            <View style={styles.itemDivider} />

            {/* Animación de Confetti */}
            <View style={styles.groupItem}>
              <View style={styles.groupItemLeft}>
                <Sparkles size={16} color="#A1A1AA" />
                <Text style={styles.itemTitle}>Celebración con Confetti</Text>
              </View>
              <Switch
                value={confettiEnabled}
                onValueChange={handleToggleConfetti}
                trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                thumbColor={confettiEnabled ? '#09090B' : '#71717A'}
              />
            </View>

            <View style={styles.itemDivider} />

            {/* Sincronización Manual */}
            <Pressable
              onPress={handleManualSync}
              disabled={syncing}
              style={styles.groupItem}
            >
              <View style={styles.groupItemLeft}>
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <RefreshCw size={16} color="#A1A1AA" />
                )}
                <Text style={styles.itemTitle}>Sincronizar con la Nube</Text>
              </View>
              <ChevronRight size={16} color="#52525B" />
            </Pressable>
          </View>
        </View>

        {/* Botón de Cerrar Sesión */}
        <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
          <LogOut size={15} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </Pressable>

        {/* Versión */}
        <Text style={styles.versionText}>Synapse Personal v2.0.0</Text>
      </ScrollView>

      {/* Modal de Editar Perfil con KeyboardAvoidingView */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseEditProfile}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
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
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    paddingHorizontal: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
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
    fontSize: 18,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userEmail: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  editIconBadge: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionBlock: {
    gap: 6,
  },
  sectionHeaderTitle: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: '#101014',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
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
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  versionText: {
    color: '#3F3F46',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
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
