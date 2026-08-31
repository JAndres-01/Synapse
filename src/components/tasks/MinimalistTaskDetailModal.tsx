import React, { useState } from 'react'
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
  if (!task) return null

  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isCompleted = task.status === 'completed'

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return { text: 'Sin fecha lÃ­mite', isOverdue: false, isToday: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: 'Sin fecha', isOverdue: false, isToday: false }
      const now = new Date()
      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()

      const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado']
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
        return { text: `Completada â€¢ ${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
      }
      if (isPast) {
        return { text: `VenciÃ³ el ${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: true, isToday }
      }
      if (isToday) {
        return { text: `Vence hoy a las ${timeStr}`, isOverdue: false, isToday: true }
      }
      return { text: `Vence el ${dayName} ${dayNum} de ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
    } catch {
      return { text: 'Sin fecha', isOverdue: false, isToday: false }
    }
  }

  const dueInfo = formatDueDate(task.due_date)
  const attachments = Array.isArray(task.attachments) ? task.attachments : []

  const handleToggle = () => {
    triggerHaptic(isCompleted ? 'light' : 'success')
    onToggleStatus(task.id, task.status)
  }

  const handleDelete = () => {
    Alert.alert(
      'Â¿Eliminar esta tarea?',
      'Esta acciÃ³n no se puede deshacer.',
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
              onClose()
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
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragHandle} />
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Badges de Materia y Tipo */}
            <View style={styles.badgesRow}>
              {task.subject ? (
                <View
                  style={[
                    styles.subjectPill,
                    { backgroundColor: `${task.subject.color || '#6366F1'}20` },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: task.subject.color || '#6366F1' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.subjectPillText,
                      { color: task.subject.color || '#818CF8' },
                    ]}
                  >
                    {task.subject.name}
                  </Text>
                </View>
              ) : (
                <View style={styles.generalPill}>
                  <Text style={styles.generalPillText}>General</Text>
                </View>
              )}

              {task.type === 'proyecto' && (
                <View style={styles.typePill}>
                  <Rocket size={10} color="#C084FC" />
                  <Text style={styles.typePillText}>Proyecto</Text>
                </View>
              )}

              {task.type === 'examen' && (
                <View style={styles.typePill}>
                  <FileText size={10} color="#FB7185" />
                  <Text style={styles.typePillText}>Examen</Text>
                </View>
              )}

              {task.type === 'grupal' && (
                <View style={styles.typePill}>
                  <Users size={10} color="#38BDF8" />
                  <Text style={styles.typePillText}>Grupal</Text>
                </View>
              )}
            </View>

            {/* TÃ­tulo y BotÃ³n Checkmark */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, isCompleted && styles.titleCompleted]}>
                {task.title}
              </Text>

              <Pressable
                onPress={handleToggle}
                style={[
                  styles.checkBtn,
                  isCompleted && styles.checkBtnCompleted,
                ]}
              >
                {isCompleted ? (
                  <Check size={14} color="#09090B" strokeWidth={3} />
                ) : (
                  <Check size={14} color="#52525B" />
                )}
              </Pressable>
            </View>

            {/* Banner de Fecha LÃ­mite */}
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
                    ? '#10B981'
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
            {task.description ? (
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
                            <Paperclip size={16} color="#818CF8" />
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

            {/* Botones de AcciÃ³n (Editar / Eliminar) */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onClose()
                  onEditTask?.(task)
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
        </View>

        {/* Visor Lightbox para Fotos */}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#27272A',
    maxHeight: '85%',
    paddingBottom: 34,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    position: 'relative',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3F3F46',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  generalPill: {
    backgroundColor: '#18181B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  generalPillText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#18181B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typePillText: {
    color: '#D4D4D8',
    fontSize: 11,
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
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
    lineHeight: 24,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3F3F46',
    backgroundColor: '#18181B',
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
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dueBannerOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  dueBannerCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  dueBannerText: {
    color: '#A1A1AA',
    fontSize: 12,
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
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  descriptionText: {
    color: '#E4E4E7',
    fontSize: 13.5,
    lineHeight: 20,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#27272A',
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
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentInfo: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  attachmentType: {
    color: '#71717A',
    fontSize: 10,
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
    backgroundColor: '#27272A',
    borderRadius: 14,
    paddingVertical: 12,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '700',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
