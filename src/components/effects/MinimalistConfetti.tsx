import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistConfettiProps {
  burstTrigger: number
}

// Colores brillantes y metalizados de celebración estilo Apple
const FOIL_COLORS = [
  '#FFD700', // Oro brillante
  '#10B981', // Esmeralda vibrante
  '#38BDF8', // Cian eléctrico
  '#F43F5E', // Rosa frambuesa
  '#A855F7', // Violeta
  '#FB923C', // Naranja fuego
  '#FFFFFF', // Destello blanco
]

interface SingleBurst {
  id: number
  particles: {
    id: number
    originX: number
    originY: number
    color: string
    sizeW: number
    sizeH: number
    isStar: boolean
    animProgress: Animated.Value
    targetX: number
    peakY: number
    fallY: number
    rotXSpeed: number
    rotYSpeed: number
    rotZSpeed: number
    wobbleAmp: number
    wobbleFreq: number
  }[]
}

export function MinimalistConfetti({ burstTrigger }: MinimalistConfettiProps) {
  const [bursts, setBursts] = useState<SingleBurst[]>([])

  useEffect(() => {
    if (burstTrigger <= 0) return

    const burstId = Date.now() + Math.random()
    const particles = []

    // 40 partículas con física tridimensional (3D Tumbling + Deriva ondulatoria)
    for (let i = 0; i < 40; i++) {
      const angle = -Math.PI / 2 + (Math.random() * 1.6 - 0.8) // Abanico hacia arriba
      const power = Math.random() * 260 + 380 // Impulso vertical inicial
      const targetX = Math.cos(angle) * (Math.random() * (SCREEN_WIDTH * 0.75) - SCREEN_WIDTH * 0.375)
      const peakY = -power // Punto más alto
      const fallY = peakY + Math.random() * 320 + 200 // Caída con gravedad posterior

      particles.push({
        id: i,
        originX: SCREEN_WIDTH / 2 + (Math.random() * 100 - 50),
        originY: SCREEN_HEIGHT + 10,
        color: FOIL_COLORS[i % FOIL_COLORS.length],
        sizeW: Math.random() > 0.4 ? 4 : 5.5,
        sizeH: Math.random() > 0.4 ? 8 : 5.5,
        isStar: Math.random() > 0.75,
        animProgress: new Animated.Value(0),
        targetX,
        peakY,
        fallY,
        rotXSpeed: (Math.random() - 0.5) * 8, // Vueltas 3D verticales
        rotYSpeed: (Math.random() - 0.5) * 12, // Vueltas 3D horizontales
        rotZSpeed: (Math.random() - 0.5) * 6,
        wobbleAmp: Math.random() * 35 + 15, // Amplitud del vaivén en el aire
        wobbleFreq: Math.random() * 3 + 2, // Frecuencia de aleteo
      })
    }

    const newBurst: SingleBurst = { id: burstId, particles }
    setBursts((prev) => [...prev, newBurst])

    // Animación física realista con Bezier curvo y desaceleración en el ápice
    const anims = particles.map((p) =>
      Animated.timing(p.animProgress, {
        toValue: 1,
        duration: 1350,
        easing: Easing.bezier(0.12, 0.8, 0.32, 1),
        useNativeDriver: true,
      })
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
          // Curva parabólica de subida rápida y caída con aleteo
          const translateY = p.animProgress.interpolate({
            inputRange: [0, 0.4, 0.7, 1],
            outputRange: [0, p.peakY, p.peakY + 80, p.fallY],
          })

          // Deriva horizontal con vaivén ondulatorio (flotación en el aire)
          const translateX = p.animProgress.interpolate({
            inputRange: [0, 0.3, 0.6, 0.85, 1],
            outputRange: [
              0,
              p.targetX * 0.5 - p.wobbleAmp,
              p.targetX * 0.8 + p.wobbleAmp,
              p.targetX * 0.95 - p.wobbleAmp * 0.5,
              p.targetX,
            ],
          })

          // Giros en 3D (Efecto de papel que da vueltas en el espacio)
          const rotateX = p.animProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${p.rotXSpeed * 360}deg`],
          })

          const rotateY = p.animProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${p.rotYSpeed * 360}deg`],
          })

          const rotateZ = p.animProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${p.rotZSpeed * 180}deg`],
          })

          // Desvanecimiento suave al final de la caída
          const opacity = p.animProgress.interpolate({
            inputRange: [0, 0.1, 0.7, 1],
            outputRange: [0, 1, 0.95, 0],
          })

          // Escala con micro-destello al nacer
          const scale = p.animProgress.interpolate({
            inputRange: [0, 0.15, 0.8, 1],
            outputRange: [0.3, 1.2, 1, 0.5],
          })

          return (
            <Animated.View
              key={`${burst.id}_${p.id}`}
              style={[
                styles.confettiPiece,
                {
                  left: p.originX,
                  top: p.originY,
                  width: p.sizeW,
                  height: p.sizeH,
                  backgroundColor: p.color,
                  borderRadius: p.isStar ? p.sizeW / 2 : 1,
                  opacity,
                  transform: [
                    { translateX },
                    { translateY },
                    { rotateX },
                    { rotateY },
                    { rotateZ },
                    { scale },
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
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
})
