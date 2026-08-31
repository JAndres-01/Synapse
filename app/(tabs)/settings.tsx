import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native'
import { useNativeAuth } from '@/context/NativeAuthContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Settings, Copy, Check, LogOut, User, Users, Shield } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { triggerHaptic } from '@/lib/nativeHaptics'
import { useRouter } from 'expo-router'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, classroom, signOut } = useNativeAuth()
  const [copied, setCopied] = useState(false)

  const handleCopyPin = async () => {
    if (!classroom?.invite_code) return
    triggerHaptic('light')
    await Clipboard.setStringAsync(classroom.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de Synapse?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('warning')
            await signOut()
            router.replace('/auth')
          },
        },
      ]
    )
  }

  return (
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
        <View style={styles.headerTitleRow}>
          <Settings size={20} color="#818CF8" />
          <Text style={styles.title}>Salón & Ajustes</Text>
        </View>
        <Text style={styles.subtitle}>
          Configuración personal y acceso a tu cohorte
        </Text>
      </View>

      {/* Perfil del Estudiante */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.full_name || 'E').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>
            {profile?.full_name || 'Estudiante'}
          </Text>
          <View style={styles.roleBadge}>
            <Shield size={10} color="#818CF8" />
            <Text style={styles.roleText}>
              {profile?.role === 'admin' ? 'Delegado' : 'Estudiante'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tarjeta de Código PIN del Salón */}
      <View style={styles.card}>
        <View style={styles.pinHeader}>
          <Users size={16} color="#818CF8" />
          <Text style={styles.pinTitle}>Salón Activo</Text>
        </View>

        <Text style={styles.classroomTitle}>
          {classroom?.name || 'Salón Principal'}
        </Text>

        <View style={styles.pinBox}>
          <View>
            <Text style={styles.pinLabel}>PIN DE INVITACIÓN</Text>
            <Text style={styles.pinValue}>
              {classroom?.invite_code || 'SYN-481'}
            </Text>
          </View>

          <Pressable onPress={handleCopyPin} style={styles.copyBtn}>
            {copied ? (
              <Check size={14} color="#10B981" />
            ) : (
              <Copy size={14} color="#A1A1AA" />
            )}
            <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
              {copied ? 'Copiado' : 'Copiar'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Botón de Cerrar Sesión */}
      <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
        <LogOut size={16} color="#EF4444" />
        <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    gap: 4,
    paddingHorizontal: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12,
  },
  card: {
    backgroundColor: 'rgba(24, 24, 27, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    gap: 4,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    color: '#A5B4FC',
    fontSize: 10,
    fontWeight: '600',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinTitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  classroomTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pinBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  pinLabel: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pinValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '600',
  },
  copyBtnTextSuccess: {
    color: '#10B981',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
})
