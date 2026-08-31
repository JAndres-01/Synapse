import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { supabase } from '@/lib/nativeSupabase'
import { useNativeAuth } from '@/context/NativeAuthContext'
import { useRouter } from 'expo-router'
import { KeyRound, Plus, LogOut, ArrowRight, ShieldCheck } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function JoinScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile, refreshClassroom, signOut } = useNativeAuth()

  const [pinCode, setPinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [createMode, setCreateMode] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  const handleJoinByPin = async () => {
    if (!pinCode.trim() || !user) {
      setErrorMsg('Ingresa el código PIN de tu salón.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const rawInput = pinCode.trim()
      const digitsMatch = rawInput.match(/\d+/)
      const digits = digitsMatch ? digitsMatch[0] : ''
      const standardizedPin = digits ? `SYN-${digits}` : rawInput.toUpperCase()

      // 1. Buscar salón
      const { data: rooms, error: searchErr } = await supabase
        .from('classrooms')
        .select('*')
        .or(`invite_code.ilike.${rawInput},invite_code.ilike.${standardizedPin}`)

      if (searchErr || !rooms || rooms.length === 0) {
        throw new Error('No encontramos ningún salón con ese código PIN.')
      }

      const classroom = rooms[0]

      // 2. Unirse como miembro
      const { error: joinErr } = await supabase
        .from('classroom_members')
        .upsert(
          {
            classroom_id: classroom.id,
            user_id: user.id,
            role: 'student',
          },
          { onConflict: 'classroom_id,user_id' }
        )

      if (joinErr) throw joinErr

      triggerHaptic('success')
      await refreshClassroom(user)
      router.replace('/(tabs)/today')
    } catch (err: any) {
      triggerHaptic('error')
      setErrorMsg(err.message || 'Error al unirse al salón')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !user) {
      setErrorMsg('Ingresa el nombre del nuevo salón.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const pinDigits = Math.floor(100 + Math.random() * 900)
      const generatedPin = `SYN-${pinDigits}`

      const { data: newRoom, error: createErr } = await supabase
        .from('classrooms')
        .insert({
          name: newRoomName.trim(),
          invite_code: generatedPin,
          created_by: user.id,
        })
        .select()
        .single()

      if (createErr) throw createErr

      // Asignar como admin/delegado
      await supabase
        .from('classroom_members')
        .insert({
          classroom_id: newRoom.id,
          user_id: user.id,
          role: 'admin',
        })

      triggerHaptic('success')
      await refreshClassroom(user)
      router.replace('/(tabs)/today')
    } catch (err: any) {
      triggerHaptic('error')
      setErrorMsg(err.message || 'Error creando el salón')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <KeyRound size={22} color="#818CF8" />
        </View>
        <Text style={styles.title}>
          {createMode ? 'Crear Nuevo Salón' : 'Ingresa a tu Salón'}
        </Text>
        <Text style={styles.subtitle}>
          {createMode
            ? 'Crea un salón para coordinar tareas y horario como Delegado'
            : 'Pídele el código PIN a tu delegado para acceder (ej. SYN-481)'}
        </Text>
      </View>

      <View style={styles.form}>
        {!createMode ? (
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="SYN-481"
              placeholderTextColor="#52525B"
              value={pinCode}
              onChangeText={setPinCode}
              style={[styles.input, styles.pinInput]}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Ej. Ingeniería de Software 5A"
              placeholderTextColor="#52525B"
              value={newRoomName}
              onChangeText={setNewRoomName}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>
        )}

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <Pressable
          onPress={createMode ? handleCreateRoom : handleJoinByPin}
          disabled={loading}
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#09090B" />
          ) : (
            <View style={styles.btnContent}>
              <Text style={styles.submitBtnText}>
                {createMode ? 'Crear y Continuar' : 'Unirme al Salón'}
              </Text>
              <ArrowRight size={16} color="#09090B" strokeWidth={2.5} />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic('light')
            setCreateMode(!createMode)
            setErrorMsg('')
          }}
          style={styles.toggleModeBtn}
        >
          <Text style={styles.toggleModeText}>
            {createMode
              ? '¿Ya tienes un código PIN? Unirse a salón'
              : '¿Eres delegado? Crear un nuevo salón'}
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            triggerHaptic('light')
            await signOut()
            router.replace('/auth')
          }}
          style={styles.logoutBtn}
        >
          <LogOut size={14} color="#71717A" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  input: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  pinInput: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleModeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleModeText: {
    color: '#818CF8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  logoutText: {
    color: '#71717A',
    fontSize: 12,
  },
})
