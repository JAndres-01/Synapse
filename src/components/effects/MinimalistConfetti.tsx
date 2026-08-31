import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Animated, Dimensions } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistConfettiProps {
  burstTrigger: number // Se incrementa cada vez que se tacha una tarea
}

const CONFETTI_COLORS = [
  '#F59E0B', // Oro cálido
  '#10B981', // Verde Esmeralda
  '#38BDF8', // Celeste Cielo
  '#EC4899', // Rosa
  '#A855F7', // Púrpura
  '#FCD34D', // Amarillo
  '#FFFFFF', // Blanco
]

interface SingleBurst {
  id: number
  particles: {
    id: number
    x: number
    y: number
    color: string
    width: number
    height: number
    isCircle: boolean
    animX: Animated.Value
    animY: Animated.Value
    animRotate: Animated.Value
    animOpacity: Animated.Value
  }[]
}

export function MinimalistConfetti({ burstTrigger }: MinimalistConfettiProps) {
  const [bursts, setBursts] = useState<SingleBurst[]>([])

  useEffect(() => {
    if (burstTrigger <= 0) return

    const burstId = Date.now() + Math.random()
    const particles = []

    // 32 partículas ultra-finas y delicadas estilo Apple (3px x 5px)
    for (let i = 0; i < 32; i++) {
      const angle = (Math.PI * 2 * i) / 32 + (Math.random() * 0.4 - 0.2)
      const speed = Math.random() * 140 + 70

      particles.push({
        id: i,
        x: SCREEN_WIDTH / 2 + (Math.random() * 60 - 30),
        y: SCREEN_HEIGHT * 0.42 + (Math.random() * 40 - 20),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: Math.random() > 0.4 ? 3.5 : 4.5,
        height: Math.random() > 0.4 ? 6.5 : 4.5,
        isCircle: Math.random() > 0.6,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        animRotate: new Animated.Value(0),
        animOpacity: new Animated.Value(1),
        targetX: Math.cos(angle) * speed,
        targetY: Math.sin(angle) * speed + (Math.random() * 160 + 70), // Gravedad suave
        targetRotate: (Math.random() - 0.5) * 10,
      })
    }

    const newBurst: SingleBurst = { id: burstId, particles }
    setBursts((prev) => [...prev, newBurst])

    // Iniciar animación inmediata (0 ms de latencia)
    const anims = particles.map((p: any) =>
      Animated.parallel([
        Animated.timing(p.animX, {
          toValue: p.targetX,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(p.animY, {
          toValue: p.targetY,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(p.animRotate, {
          toValue: p.targetRotate,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(450),
          Animated.timing(p.animOpacity, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
      ])
    )

    Animated.parallel(anims).start(() => {
      // Limpiar ráfaga terminada para no acumular memoria
      setBursts((prev) => prev.filter((b) => b.id !== burstId))
    })
  }, [burstTrigger])

  if (bursts.length === 0) return null

  return (
    <View style={styles.overlay} pointerEvents="none">
      {bursts.map((burst) =>
        burst.particles.map((p) => {
          const rotate = p.animRotate.interpolate({
            inputRange: [-5, 5],
            outputRange: ['-360deg', '360deg'],
          })

          return (
            <Animated.View
              key={`${burst.id}_${p.id}`}
              style={[
                styles.confettiPiece,
                {
                  left: p.x,
                  top: p.y,
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
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
})
