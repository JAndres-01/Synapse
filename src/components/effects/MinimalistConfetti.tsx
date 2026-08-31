import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Animated, Dimensions } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistConfettiProps {
  burstTrigger: number
}

const CONFETTI_COLORS = [
  '#F59E0B', // Oro cálido
  '#10B981', // Verde Esmeralda
  '#38BDF8', // Celeste Cielo
  '#EC4899', // Rosa Vibrante
  '#A855F7', // Púrpura
  '#FCD34D', // Amarillo Dorado
  '#FFFFFF', // Blanco
]

interface SingleBurst {
  id: number
  particles: {
    id: number
    startX: number
    startY: number
    color: string
    width: number
    height: number
    isCircle: boolean
    animX: Animated.Value
    animY: Animated.Value
    animRotate: Animated.Value
    animOpacity: Animated.Value
    targetX: number
    targetY: number
    targetRotate: number
  }[]
}

export function MinimalistConfetti({ burstTrigger }: MinimalistConfettiProps) {
  const [bursts, setBursts] = useState<SingleBurst[]>([])

  useEffect(() => {
    if (burstTrigger <= 0) return

    const burstId = Date.now() + Math.random()
    const particles = []

    // 36 micro-partículas que nacen desde abajo de la pantalla y suben como fuegos artificiales
    for (let i = 0; i < 36; i++) {
      // Ángulo hacia arriba: entre -135deg y -45deg (hacia el cielo)
      const angle = -Math.PI / 2 + (Math.random() * 1.4 - 0.7) // Abanico hacia arriba
      const launchPower = Math.random() * (SCREEN_HEIGHT * 0.55) + SCREEN_HEIGHT * 0.35 // Altura de elevación

      const targetX = Math.cos(angle) * (launchPower * 0.65) + (Math.random() * 80 - 40)
      const targetY = -launchPower + (Math.random() * 80) // Sube hasta el 60%-80% de la pantalla

      particles.push({
        id: i,
        startX: SCREEN_WIDTH / 2 + (Math.random() * 120 - 60), // Centro inferior
        startY: SCREEN_HEIGHT + 10, // Nace abajo de la pantalla
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: Math.random() > 0.4 ? 3.5 : 4.5,
        height: Math.random() > 0.4 ? 7 : 4.5,
        isCircle: Math.random() > 0.6,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        animRotate: new Animated.Value(0),
        animOpacity: new Animated.Value(1),
        targetX,
        targetY,
        targetRotate: (Math.random() - 0.5) * 12,
      })
    }

    const newBurst: SingleBurst = { id: burstId, particles }
    setBursts((prev) => [...prev, newBurst])

    // Animación de disparo de abajo hacia arriba (0 ms de latencia)
    const anims = particles.map((p) =>
      Animated.parallel([
        // Eje X: se abre en abanico
        Animated.timing(p.animX, {
          toValue: p.targetX,
          duration: 1050,
          useNativeDriver: true,
        }),
        // Eje Y: sube rápido y desacelera en el punto alto
        Animated.timing(p.animY, {
          toValue: p.targetY,
          duration: 1050,
          useNativeDriver: true,
        }),
        // Rotación continua
        Animated.timing(p.animRotate, {
          toValue: p.targetRotate,
          duration: 1050,
          useNativeDriver: true,
        }),
        // Desvanecimiento suave después del pico de altura
        Animated.sequence([
          Animated.delay(550),
          Animated.timing(p.animOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ])
    )

    Animated.parallel(anims).start(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burstId))
    })
  }, [burstTrigger])

  if (bursts.length === 0) return null

  return (
    <View style={styles.overlay} pointerEvents="none">
      {bursts.map((burst) =>
        burst.particles.map((p) => {
          const rotate = p.animRotate.interpolate({
            inputRange: [-6, 6],
            outputRange: ['-540deg', '540deg'],
          })

          return (
            <Animated.View
              key={`${burst.id}_${p.id}`}
              style={[
                styles.confettiPiece,
                {
                  left: p.startX,
                  top: p.startY,
                  width: p.width,
                  height: p.height,
                  backgroundColor: p.color,
                  borderRadius: p.isCircle ? p.width / 2 : 1.5,
                  opacity: p.animOpacity,
                  transform: [
                    { translateX: p.animX },
                    { translateY: p.animY },
                    { rotate },
                  ],
                },
              ]}
            />
          )
        })
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  confettiPiece: {
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1.5,
  },
})
