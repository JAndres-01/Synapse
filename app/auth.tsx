import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '@/lib/nativeSupabase'
import { useRouter } from 'expo-router'
import { Sparkles, Mail, Lock, User, ArrowRight } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/nativeHaptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function AuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMsg('Por favor completa todos los campos requeridos.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        triggerHaptic('success')
        router.replace('/')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || 'Estudiante',
            },
          },
        })
        if (error) throw error
        triggerHaptic('success')
        router.replace('/')
      }
    } catch (err: any) {
      triggerHaptic('error')
      setErrorMsg(err.message || 'Error durante la autenticación')
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
        <View style={styles.logoBadge}>
          <Sparkles size={20} color="#818CF8" />
        </View>
        <Text style={styles.appName}>Synapse</Text>
        <Text style={styles.appSubtitle}>
          {mode === 'login'
            ? 'Bienvenido de nuevo a tu espacio académico'
            : 'Crea tu cuenta para acceder a tu salón'}
        </Text>
      </View>

      {/* Selector Modo: Iniciar Sesión / Registrarse */}
      <View style={styles.modeSelector}>
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            setMode('login')
            setErrorMsg('')
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
            setErrorMsg('')
          }}
          style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeBtnText, mode === 'register' && styles.modeBtnTextActive]}>
            Crear Cuenta
          </Text>
        </Pressable>
      </View>

      {/* Formulario */}
      <View style={styles.form}>
        {mode === 'register' && (
          <View style={styles.inputContainer}>
            <User size={16} color="#71717A" style={styles.inputIcon} />
            <TextInput
              placeholder="Nombre y Apellido"
              placeholderTextColor="#52525B"
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.inputContainer}>
          <Mail size={16} color="#71717A" style={styles.inputIcon} />
          <TextInput
            placeholder="correo@universidad.edu"
            placeholderTextColor="#52525B"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={16} color="#71717A" style={styles.inputIcon} />
          <TextInput
            placeholder="Contraseña"
            placeholderTextColor="#52525B"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
          />
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <Pressable
          onPress={handleAuth}
          disabled={loading}
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#09090B" />
          ) : (
            <View style={styles.submitBtnContent}>
              <Text style={styles.submitBtnText}>
                {mode === 'login' ? 'Entrar a Synapse' : 'Registrar Cuenta'}
              </Text>
              <ArrowRight size={16} color="#09090B" strokeWidth={2.5} />
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
    marginBottom: 28,
  },
  logoBadge: {
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
  appName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  modeBtnActive: {
    backgroundColor: '#27272A',
  },
  modeBtnText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  form: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
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
    marginTop: 8,
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
    fontSize: 14,
    fontWeight: '700',
  },
})
