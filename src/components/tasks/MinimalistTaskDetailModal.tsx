import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native'
import type { Task, TaskAttachment } from '@/types/personal'
import {
  X,
  Clock,
  Trash2,
  Edit2,
  Check,
  Rocket,
  FileText,
  Users,
  Paperclip,
  ExternalLink,
} from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import * as Linking from 'expo-linking'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface MinimalistTaskDetailModalProps {
  task: Task | null
  visible: boolean
  onClose: () => void
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onDeleteTask?: (taskId: string) => Promise<void>
  onEditTask?: (task: Task) => void
}

export function MinimalistTaskDetailModal({
  task,
  visible,
  onClose,
  onToggleStatus,
  onDeleteTask,
  onEditTask,
}: MinimalistTaskDetailModalProps) {
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Animaciones independientes: Backdrop estático con fade + Sheet con deslizamiento elástico
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const [modalVisible, setModalVisible] = useState(visible)

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          stiffness: 480,
          damping: 32,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
      })
    }
  }, [visible, fadeAnim, slideAnim])

  const handleSmoothClose = () => {
    triggerHaptic('light')
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose()
    })
  }

  if (!task && !modalVisible) return null

  const isCompleted = task?.status === 'completed'
  const isWhite = task?.subject?.color === '#FFFFFF'

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return { text: 'Sin fecha límite', isOverdue: false, isToday: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: 'Sin fecha', isOverdue: false, isToday: false }
      const now = new Date()
      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()

      const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

      const dayName = daysOfWeek[date.getDay()]
      const dayNum = date.getDate()
      const monthName = months[date.getMonth()]
      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const formattedHour = hours % 12 || 12
      const timeStr = `${formattedHour}:${minutes} ${ampm}`

      if (isCompleted) {
        return { text: `Completada • ${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
      }
      if (isPast) {
        return { text: `Venció el ${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: true, isToday }
      }
      if (isToday) {
        return { text: `Vence hoy a las ${timeStr}`, isOverdue: false, isToday: true }
      }
      return { text: `Vence el ${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
    } catch {
      return { text: 'Sin fecha', isOverdue: false, isToday: false }
    }
  }

  const dueInfo = formatDueDate(task?.due_date)
  const attachments = Array.isArray(task?.attachments) ? task.attachments : []

  const handleToggle = () => {
    if (!task) return
    triggerHaptic(isCompleted ? 'selection' : 'success')
    onToggleStatus(task.id, task.status)
  }

  const handleDelete = () => {
    if (!task) return
    Alert.alert(
      '¿Eliminar esta tarea?',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('error')
              setDeleteLoading(true)
              await onDeleteTask?.(task.id)
              handleSmoothClose()
            } catch (err) {
              console.error('Error eliminando:', err)
            } finally {
              setDeleteLoading(false)
            }
          },
        },
      ]
    )
  }

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Fondo Translúcido Estático con Fade (NO se desliza con la pantalla) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Estilo Apple con Deslizamiento Elástico */}
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Badges de Materia y Tipo */}
            <View style={styles.badgesRow}>
              {task?.subject ? (
                <View
                  style={[
                    styles.subjectPill,
                    {
                      backgroundColor: isWhite
                        ? 'rgba(255, 255, 255, 0.15)'
                        : `${task.subject.color || '#FFFFFF'}22`,
                      borderColor: isWhite
                        ? 'rgba(255, 255, 255, 0.35)'
                        : `${task.subject.color || '#FFFFFF'}50`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: task.subject.color || '#FFFFFF' },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.subjectPillText}>
                    {task.subject.name}
                  </Text>
                </View>
              ) : (
                <View style={styles.generalPill}>
                  <Text style={styles.generalPillText}>General</Text>
                </View>
              )}

              {task?.type === 'proyecto' && (
                <View style={styles.typePill}>
                  <Rocket size={11} color="#C084FC" />
                  <Text style={styles.typePillText}>Proyecto</Text>
                </View>
              )}

              {task?.type === 'examen' && (
                <View style={styles.typePill}>
                  <FileText size={11} color="#FB7185" />
                  <Text style={styles.typePillText}>Examen</Text>
                </View>
              )}

              {task?.type === 'grupal' && (
                <View style={styles.typePill}>
                  <Users size={11} color="#38BDF8" />
                  <Text style={styles.typePillText}>Grupal</Text>
                </View>
              )}
            </View>

            {/* Título y Botón Checkmark */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, isCompleted && styles.titleCompleted]}>
                {task?.title}
              </Text>

              <Pressable
                onPress={handleToggle}
                style={[
                  styles.checkBtn,
                  isCompleted && styles.checkBtnCompleted,
                ]}
                hitSlop={8}
              >
                {isCompleted ? (
                  <Check size={15} color="#09090B" strokeWidth={3} />
                ) : (
                  <Check size={15} color="#52525B" />
                )}
              </Pressable>
            </View>

            {/* Banner de Fecha Límite con Tono Muted */}
            <View
              style={[
                styles.dueBanner,
                dueInfo.isOverdue && styles.dueBannerOverdue,
                isCompleted && styles.dueBannerCompleted,
              ]}
            >
              <Clock
                size={14}
                color={
                  isCompleted
                    ? '#34D399'
                    : dueInfo.isOverdue
                    ? '#F87171'
                    : '#A1A1AA'
                }
              />
              <Text
                style={[
                  styles.dueBannerText,
                  dueInfo.isOverdue && styles.dueBannerTextOverdue,
                  isCompleted && styles.dueBannerTextCompleted,
                ]}
              >
                {dueInfo.text}
              </Text>
            </View>

            {/* Notas / Instrucciones */}
            {task?.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>NOTAS / INSTRUCCIONES</Text>
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionText}>{task.description}</Text>
                </View>
              </View>
            ) : null}

            {/* Fotos y Archivos Adjuntos */}
            {attachments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  FOTOS Y ADJUNTOS ({attachments.length})
                </Text>
                <View style={styles.attachmentsList}>
                  {attachments.map((att: TaskAttachment, idx: number) => {
                    const isImg =
                      att.file_type === 'image' ||
                      att.file_url?.match(/\.(jpeg|jpg|png|webp|gif)/i)
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => {
                          if (isImg) {
                            setSelectedLightboxImage(att.file_url)
                          } else if (att.file_url) {
                            Linking.openURL(att.file_url)
                          }
                        }}
                        style={styles.attachmentCard}
                      >
                        {isImg ? (
                          <Image
                            source={{ uri: att.file_url }}
                            style={styles.attachmentImgThumbnail}
                          />
                        ) : (
                          <View style={styles.attachmentDocIcon}>
                            <Paperclip size={16} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={styles.attachmentInfo}>
                          <Text style={styles.attachmentName} numberOfLines={1}>
                            {att.file_name || 'Foto adjunta'}
                          </Text>
                          <Text style={styles.attachmentType}>
                            {isImg ? 'Toca para ampliar foto' : 'Toca para abrir enlace'}
                          </Text>
                        </View>
                        <ExternalLink size={14} color="#71717A" />
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Botones de Acción (Editar / Eliminar) */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  if (task) {
                    onClose()
                    onEditTask?.(task)
                  }
                }}
                style={styles.editBtn}
              >
                <Edit2 size={14} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Editar Tarea</Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                disabled={deleteLoading}
                style={styles.deleteBtn}
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Trash2 size={14} color="#EF4444" />
                    <Text style={styles.deleteBtnText}>Eliminar</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>

        {/* Visor Lightbox para Fotos en Pantalla Completa */}
        {selectedLightboxImage && (
          <Modal visible={true} transparent={true} animationType="fade">
            <Pressable
              style={styles.lightboxBackdrop}
              onPress={() => setSelectedLightboxImage(null)}
            >
              <Image
                source={{ uri: selectedLightboxImage }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              <Text style={styles.lightboxTip}>Toca en cualquier lugar para cerrar</Text>
            </Pressable>
          </Modal>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
    paddingBottom: 36,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    top: 10,
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: {
    borderWidth: 0.8,
    borderColor: '#71717A',
  },
  subjectPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  generalPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  generalPillText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  typePillText: {
    color: '#D4D4D8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
    lineHeight: 25,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#3F3F46',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dueBannerOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  dueBannerCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  dueBannerText: {
    color: '#A1A1AA',
    fontSize: 12.5,
    fontWeight: '600',
  },
  dueBannerTextOverdue: {
    color: '#F87171',
  },
  dueBannerTextCompleted: {
    color: '#34D399',
  },
  section: {
    marginTop: 18,
    gap: 6,
  },
  sectionLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  descriptionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  descriptionText: {
    color: '#E4E4E7',
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  attachmentImgThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#27272A',
  },
  attachmentDocIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentInfo: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  attachmentType: {
    color: '#71717A',
    fontSize: 10.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    marginBottom: 10,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  lightboxTip: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 16,
  },
})
