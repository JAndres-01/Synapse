import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage } from '@/lib/personalStorage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Settings, LogOut, ShieldCheck, BookOpen, CheckSquare, Cloud } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useRouter } from 'expo-router'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, signOut } = usePersonalAuth()

  const [subjectsCount, setSubjectsCount] = useState(0)
  const [tasksCount, setTasksCount] = useState(0)
  const [completedTasksCount, setCompletedTasksCount] = useState(0)

  useEffect(() => {
    personalStorage.getSubjects().then((s) => setSubjectsCount(s.length))
    personalStorage.getTasks().then((t) => {
      setTasksCount(t.length)
      setCompletedTasksCount(t.filter((task) => task.status === 'completed').length)
    })
  }, [])

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
          <Settings size={18} color="#818CF8" />
          <Text style={styles.title}>Ajustes y Perfil</Text>
        </View>
        <Text style={styles.subtitle}>Tu cuenta personal y estado de respaldo</Text>
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
          <Text style={styles.userEmail}>{profile?.email || 'Sin correo'}</Text>
        </View>
      </View>

      {/* Estadísticas Personales */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>RESUMEN ACADÉMICO</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <BookOpen size={16} color="#818CF8" />
            <Text style={styles.statNumber}>{subjectsCount}</Text>
            <Text style={styles.statLabel}>Materias</Text>
          </View>

          <View style={styles.statItem}>
            <CheckSquare size={16} color="#10B981" />
            <Text style={styles.statNumber}>
              {completedTasksCount}/{tasksCount}
            </Text>
            <Text style={styles.statLabel}>Entregadas</Text>
          </View>

          <View style={styles.statItem}>
            <ShieldCheck size={16} color="#FBBF24" />
            <Text style={styles.statNumber}>100%</Text>
            <Text style={styles.statLabel}>Privado</Text>
          </View>
        </View>
      </View>

      {/* Estado de Sincronización en la Nube */}
      <View style={styles.card}>
        <View style={styles.syncRow}>
          <View style={styles.syncIconBox}>
            <Cloud size={18} color="#10B981" />
          </View>
          <View style={styles.syncInfo}>
            <Text style={styles.syncTitle}>Sincronización Offline-First</Text>
            <Text style={styles.syncSub}>
              Tus datos se guardan en tu iPhone y se respaldan en Supabase
            </Text>
          </View>
        </View>
      </View>

      {/* Botón de Cerrar Sesión */}
      <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
        <LogOut size={15} color="#EF4444" />
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
    gap: 14,
  },
  header: {
    gap: 2,
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
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  profileInfo: {
    gap: 2,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    color: '#71717A',
    fontSize: 12,
  },
  cardSectionTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: '#71717A',
    fontSize: 10.5,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncInfo: {
    flex: 1,
    gap: 2,
  },
  syncTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  syncSub: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
})
