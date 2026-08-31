import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Share,
} from 'react-native'
import { useNativeAuth } from '@/context/NativeAuthContext'
import { supabase } from '@/lib/nativeSupabase'
import type { ClassroomMember, Profile } from '@/types/database'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Settings, Copy, Check, LogOut, Users, Shield, Share2, Sparkles, UserCheck } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { triggerHaptic } from '@/lib/nativeHaptics'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile, classroom, signOut } = useNativeAuth()
  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState<Array<{ user_id: string; role: string; profile?: Profile }>>([])

  const fetchMembers = useCallback(async () => {
    if (!classroom) return

    try {
      const { data, error } = await supabase
        .from('classroom_members')
        .select('user_id, role, profile:profiles(*)')
        .eq('classroom_id', classroom.id)

      if (data && !error) {
        setMembers(data as any)
      }
    } catch (err) {
      console.error('Error cargando miembros:', err)
    }
  }, [classroom])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleCopyPin = async () => {
    if (!classroom?.invite_code) return
    triggerHaptic('light')
    await Clipboard.setStringAsync(classroom.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSharePin = async () => {
    if (!classroom?.invite_code) return
    triggerHaptic('light')
    try {
      await Share.share({
        message: `¡Únete a nuestro salón "${classroom.name}" en Synapse! Usa el código PIN: ${classroom.invite_code}`,
      })
    } catch {}
  }

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
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
          Configuración personal y miembros de tu salón
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

          <View style={styles.pinActions}>
            <Pressable onPress={handleCopyPin} style={styles.copyBtn}>
              {copied ? (
                <Check size={13} color="#10B981" />
              ) : (
                <Copy size={13} color="#A1A1AA" />
              )}
              <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
                {copied ? 'Copiado' : 'Copiar'}
              </Text>
            </Pressable>

            <Pressable onPress={handleSharePin} style={styles.shareBtn}>
              <Share2 size={13} color="#818CF8" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Lista de Compañeros de Salón */}
      <View style={styles.card}>
        <View style={styles.membersHeader}>
          <UserCheck size={16} color="#818CF8" />
          <Text style={styles.membersTitle}>
            Compañeros de Salón ({members.length})
          </Text>
        </View>

        <View style={styles.membersList}>
          {members.map((m, idx) => {
            const memberProfile = m.profile as Profile | undefined
            const memberName = memberProfile?.full_name || 'Estudiante'
            const isDelegado = m.role === 'admin' || memberProfile?.role === 'admin'
            const isCurrentUser = m.user_id === user?.id

            return (
              <View key={m.user_id || idx} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {memberName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.memberInfo}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {memberName} {isCurrentUser ? '(Tú)' : ''}
                  </Text>
                </View>

                {isDelegado && (
                  <View style={styles.delegadoPill}>
                    <Text style={styles.delegadoPillText}>Delegado</Text>
                  </View>
                )}
              </View>
            )
          })}
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
  pinActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  copyBtnText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '600',
  },
  copyBtnTextSuccess: {
    color: '#10B981',
  },
  shareBtn: {
    backgroundColor: '#27272A',
    padding: 7,
    borderRadius: 9,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  membersTitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  membersList: {
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  delegadoPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  delegadoPillText: {
    color: '#818CF8',
    fontSize: 9.5,
    fontWeight: '600',
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
    marginTop: 6,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
})
