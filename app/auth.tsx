import React, { useState, useRef } from 'react'
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
  Animated,
  LayoutChangeEvent,
} from 'react-native'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { triggerHaptic } from '@/lib/personalHaptics'
import { BlurView } from 'expo-blur'
import { Sparkles, ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native'

export default function AuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signInWithEmail, signUpWithEmail } = usePersonalAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Animación del Selector Segmentado
  const [containerWidth, setContainerWidth] = useState(0)
  const slideAnim = useRef(new Animated.Value(0)).current
  const segmentWidth = containerWidth > 0 ? (containerWidth - 6) / 2 : 140

  const handleModeChange = (newMode: 'login' | 'register') => {
    if (newMode === mode) return
    triggerHaptic('selection')
    setMode(newMode)
    Animated.spring(slideAnim, {
      toValue: newMode === 'login' ? 0 : segmentWidth,
      stiffness: 550,
      damping: 32,
      mass: 0.8,
      useNativeDriver: true,
    }).start()
  }

  const getFriendlyErrorMessage = (errorMsg: string) => {
    const msg = errorMsg.toLowerCase()
    if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
      return 'Correo o contraseña incorrectos. Por favor verifica tus credenciales o crea una cuenta nueva si no te has registrado.'
    }
    if (msg.includes('email not confirmed')) {
      return 'Tu correo aún no ha sido confirmado. Por favor revisa tu bandeja de entrada o spam.'
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'Ya existe una cuenta con este correo electrónico. Por favor selecciona "Iniciar Sesión".'
    }
    if (msg.includes('password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.'
    }
    if (msg.includes('network request failed') || msg.includes('fetch failed')) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.'
    }
    return errorMsg || 'Ocurrió un error inesperado al autenticar.'
  }

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanPass = password.trim()

    if (!cleanEmail || !cleanPass) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.')
      triggerHaptic('warning')
      return
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Correo Inválido', 'Por favor introduce un formato de correo válido (ej. usuario@dominio.com).')
      triggerHaptic('warning')
      return
    }

    if (mode === 'register' && !fullName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre completo.')
      triggerHaptic('warning')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        await signInWithEmail(cleanEmail, cleanPass)
        triggerHaptic('success')
        router.replace('/(tabs)/today')
      } else {
        await signUpWithEmail(cleanEmail, cleanPass, fullName.trim())
        triggerHaptic('success')
        Alert.alert(
          '¡Cuenta creada con éxito!',
          'Bienvenido a Synapse Personal. Ya puedes empezar a organizar tus clases y tareas.',
          [{ text: 'Comenzar', onPress: () => router.replace('/(tabs)/today') }]
        )
      }
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err.message || '')
      Alert.alert('Error de Autenticación', friendlyMsg)
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
          <Sparkles size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Synapse</Text>
        <Text style={styles.subtitle}>Tu Asistente Académico Personal</Text>
      </View>

      <View style={styles.formContainer}>
        {/* Selector Glassmórfico de Modo (Iniciar Sesión / Crear Cuenta) */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 55 : 90}
          tint={Platform.OS === 'ios' ? 'systemThinMaterialDark' : 'dark'}
          style={styles.segmentedContainer}
          onLayout={(e: LayoutChangeEvent) => {
            setContainerWidth(e.nativeEvent.layout.width)
          }}
        >
          <Animated.View
            style={[
              styles.activeSegmentPill,
              {
                width: segmentWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />

          <Pressable
            onPress={() => handleModeChange('login')}
            style={styles.segmentButton}
          >
            <Text
              style={[
                styles.segmentButtonText,
                mode === 'login' && styles.segmentButtonTextActive,
              ]}
            >
              Iniciar Sesión
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleModeChange('register')}
            style={styles.segmentButton}
          >
            <Text
              style={[
                styles.segmentButtonText,
                mode === 'register' && styles.segmentButtonTextActive,
              ]}
            >
              Crear Cuenta
            </Text>
          </Pressable>
        </BlurView>

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
                autoCorrect={false}
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
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>CONTRASEÑA</Text>
          <View style={styles.inputBox}>
            <Lock size={15} color="#71717A" style={styles.inputIcon} />
            <TextInput
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#52525B"
              value={password}
              onChangeText={setPassword}
              style={styles.textInput}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={8}
              style={styles.eyeBtn}
            >
              {showPassword ? (
                <EyeOff size={16} color="#71717A" />
              ) : (
                <Eye size={16} color="#71717A" />
              )}
            </Pressable>
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
    marginBottom: 28,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#101014',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    fontWeight: '500',
  },
  formContainer: {
    gap: 14,
  },
  segmentedContainer: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 3,
    height: 42,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  activeSegmentPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentButtonText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
  },
  segmentButtonTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101014',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  submitBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
})
