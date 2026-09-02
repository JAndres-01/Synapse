import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: any
}

export function SkeletonBox({ width = '100%', height = 20, borderRadius = 10, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  )
}

export function MinimalistScreenSkeleton() {
  return (
    <View style={styles.screenContainer}>
      {/* Header Skeleton */}
      <View style={styles.headerRow}>
        <View>
          <SkeletonBox width={120} height={14} borderRadius={6} style={{ marginBottom: 8 }} />
          <SkeletonBox width={180} height={28} borderRadius={8} />
        </View>
        <SkeletonBox width={36} height={36} borderRadius={18} />
      </View>

      {/* Hero / Top Card Skeleton */}
      <SkeletonBox width="100%" height={120} borderRadius={18} style={{ marginVertical: 20 }} />

      {/* Section Title */}
      <SkeletonBox width={140} height={18} borderRadius={6} style={{ marginBottom: 14 }} />

      {/* Task List / Content Cards */}
      <SkeletonBox width="100%" height={76} borderRadius={16} style={{ marginBottom: 10 }} />
      <SkeletonBox width="100%" height={76} borderRadius={16} style={{ marginBottom: 10 }} />
      <SkeletonBox width="100%" height={76} borderRadius={16} style={{ marginBottom: 10 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
})
