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
  Alert,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { triggerHaptic } from '@/lib/personalHaptics'
import { Sparkles, ArrowRight, Mail, Lock, User } from 'lucide-react-native'

export default function AuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signInWithEmail, signUpWithEmail } = usePersonalAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.')
      triggerHaptic('warning')
      return
    }

    if (mode === 'register' && !fullName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await signInWithEmail(email, password)
        if (error) throw error
        triggerHaptic('success')
        router.replace('/(tabs)/today')
      } else {
        const { error } = await signUpWithEmail(email, password, fullName)
        if (error) throw error
        triggerHaptic('success')
        Alert.alert('¡Cuenta creada!', 'Bienvenido a Synapse Personal.', [
          { text: 'Comenzar', onPress: () => router.replace('/(tabs)/today') },
        ])
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar sesión.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Sparkles size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Synapse</Text>
        <Text style={styles.subtitle}>Tu Asistente Académico Personal</Text>
      </View>

      <View style={styles.formContainer}>
        {/* Toggle Modo */}
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setMode('login')
            }}
            style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>
              Iniciar Sesión
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light')
              setMode('register')
            }}
            style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'register' && styles.modeBtnTextActive]}>
              Crear Cuenta
            </Text>
          </Pressable>
        </View>

        {/* Inputs */}
        {mode === 'register' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
            <View style={styles.inputBox}>
              <User size={15} color="#71717A" style={styles.inputIcon} />
              <TextInput
                placeholder="Ej. José Morales"
                placeholderTextColor="#52525B"
                value={fullName}
                onChangeText={setFullName}
                style={styles.textInput}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
          <View style={styles.inputBox}>
            <Mail size={15} color="#71717A" style={styles.inputIcon} />
            <TextInput
              placeholder="estudiante@universidad.edu"
              placeholderTextColor="#52525B"
              value={email}
              onChangeText={setEmail}
              style={styles.textInput}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>CONTRASEÑA</Text>
          <View style={styles.inputBox}>
            <Lock size={15} color="#71717A" style={styles.inputIcon} />
            <TextInput
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              placeholderTextColor="#52525B"
              value={password}
              onChangeText={setPassword}
              style={styles.textInput}
              secureTextEntry
            />
          </View>
        </View>

        {/* Botón Principal */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#09090B" />
          ) : (
            <View style={styles.submitBtnContent}>
              <Text style={styles.submitBtnText}>
                {mode === 'login' ? 'Entrar a Synapse' : 'Registrar mi Cuenta'}
              </Text>
              <ArrowRight size={15} color="#09090B" strokeWidth={2.5} />
            </View>
          )}
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
    marginBottom: 32,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 4,
  },
  formContainer: {
    gap: 14,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 6,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  modeBtnText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#09090B',
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
  },
  submitBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '800',
  },
})
