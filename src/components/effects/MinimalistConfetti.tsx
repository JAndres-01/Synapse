import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, Dimensions } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface ConfettiPiece {
  id: number
  x: number
  y: number
  color: string
  size: number
  isCircle: boolean
  animX: Animated.Value
  animY: Animated.Value
  animRotate: Animated.Value
  animOpacity: Animated.Value
}

interface MinimalistConfettiProps {
  visible: boolean
  onAnimationEnd?: () => void
}

const CONFETTI_COLORS = [
  '#10B981', // Verde Esmeralda
  '#3B82F6', // Azul Eléctrico
  '#F59E0B', // Ámbar
  '#EC4899', // Rosa
  '#8B5CF6', // Púrpura
  '#FFFFFF', // Blanco
  '#06B6D4', // Cian
]

export function MinimalistConfetti({ visible, onAnimationEnd }: MinimalistConfettiProps) {
  const pieces = useRef<ConfettiPiece[]>([]).current

  if (pieces.length === 0) {
    for (let i = 0; i < 36; i++) {
      pieces.push({
        id: i,
        x: SCREEN_WIDTH / 2 + (Math.random() * 80 - 40),
        y: SCREEN_HEIGHT * 0.45 + (Math.random() * 60 - 30),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: Math.floor(Math.random() * 6) + 6,
        isCircle: Math.random() > 0.5,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        animRotate: new Animated.Value(0),
        animOpacity: new Animated.Value(1),
      })
    }
  }

  useEffect(() => {
    if (!visible) return

    const animations = pieces.map((piece) => {
      piece.animX.setValue(0)
      piece.animY.setValue(0)
      piece.animRotate.setValue(0)
      piece.animOpacity.setValue(1)

      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * 160 + 70
      const targetX = Math.cos(angle) * distance
      const targetY = Math.sin(angle) * distance + (Math.random() * 190 + 90) // Gravedad
      const targetRotate = (Math.random() - 0.5) * 8

      return Animated.parallel([
        Animated.timing(piece.animX, {
          toValue: targetX,
          duration: 1150,
          useNativeDriver: true,
        }),
        Animated.timing(piece.animY, {
          toValue: targetY,
          duration: 1150,
          useNativeDriver: true,
        }),
        Animated.timing(piece.animRotate, {
          toValue: targetRotate,
          duration: 1150,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(700),
          Animated.timing(piece.animOpacity, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
      ])
    })

    Animated.parallel(animations).start(() => {
      onAnimationEnd?.()
    })
  }, [visible, pieces, onAnimationEnd])

  if (!visible) return null

  return (
    <View style={styles.overlay} pointerEvents="none">
      {pieces.map((p) => {
        const rotate = p.animRotate.interpolate({
          inputRange: [-4, 4],
          outputRange: ['-360deg', '360deg'],
        })

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.confettiPiece,
              {
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.isCircle ? p.size : p.size * 1.6,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? p.size / 2 : 2,
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
      })}
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
  },
})
