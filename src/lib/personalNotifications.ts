import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { Task, Schedule, AppPreferences } from '@/types/personal'
import { personalStorage } from './personalStorage'

// Configurar comportamiento de notificaciones para iOS y Android
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPresentAlert: true,
    }),
  })
} catch {}

/**
 * Solicita permisos de notificación al sistema operativo (iOS / Android)
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      })
      finalStatus = status
    }
    return finalStatus === 'granted'
  } catch (err) {
    console.log('Error solicitando permisos de notificación:', err)
    return false
  }
}

/**
 * Cancela el recordatorio de una tarea específica (al tacharla o eliminarla)
 */
export async function cancelTaskReminder(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`task_adv_${taskId}`)
  } catch {}
}

/**
 * Programa el recordatorio con antelación de 1 día a la hora fijada para una tarea
 */
export async function scheduleTaskReminder(
  task: Task,
  prefs: AppPreferences
): Promise<void> {
  if (task.status !== 'pending' || !task.due_date || !prefs.advance_reminder_enabled) {
    await cancelTaskReminder(task.id)
    return
  }

  try {
    const taskDueDate = new Date(task.due_date)
    if (isNaN(taskDueDate.getTime())) return

    // Obtener hora y minuto configurados en ajustes (ej. "20:00")
    const [prefHourStr, prefMinStr] = (prefs.advance_reminder_time || '20:00').split(':')
    const prefHour = parseInt(prefHourStr, 10) || 20
    const prefMin = parseInt(prefMinStr, 10) || 0

    // Calcular fecha del día anterior a la hora configurada
    const reminderDate = new Date(taskDueDate)
    reminderDate.setDate(reminderDate.getDate() - 1)
    reminderDate.setHours(prefHour, prefMin, 0, 0)

    const now = new Date()
    // Si la fecha de recordatorio ya pasó, no programar
    if (reminderDate.getTime() <= now.getTime()) {
      await cancelTaskReminder(task.id)
      return
    }

    // Cancelar cualquier recordatorio previo de esta tarea
    await cancelTaskReminder(task.id)

    const subjName = task.subject?.name || 'General'

    // Programar notificación limpia
    await Notifications.scheduleNotificationAsync({
      identifier: `task_adv_${task.id}`,
      content: {
        title: 'Mañana tienes entrega',
        body: `"${task.title}" • ${subjName}`,
        sound: true,
        data: { taskId: task.id, type: 'task_advance' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    })
  } catch (err) {
    console.log('Error programando recordatorio de tarea:', err)
  }
}

/**
 * Programa los avisos de próximas clases (10 minutos antes con la materia correspondiente)
 */
export async function scheduleClassReminders(
  schedules: Schedule[],
  prefs: AppPreferences
): Promise<void> {
  // Cancelar todas las alertas de clases previas para evitar duplicados
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    for (const notif of scheduled) {
      if (notif.identifier.startsWith('class_sched_')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier)
      }
    }
  } catch {}

  if (!prefs.class_reminder_enabled) return

  for (const item of schedules) {
    if (!item.subject || !item.start_time) continue

    try {
      const [startHourStr, startMinStr] = item.start_time.split(':')
      const startHour = parseInt(startHourStr, 10)
      const startMin = parseInt(startMinStr, 10)

      if (isNaN(startHour) || isNaN(startMin)) continue

      // Calcular 10 minutos antes de la clase
      let notifMin = startMin - 10
      let notifHour = startHour
      if (notifMin < 0) {
        notifMin += 60
        notifHour -= 1
      }
      if (notifHour < 0) notifHour += 24

      // En Expo Notifications: 1=Domingo, 2=Lunes, 3=Martes, 4=Miércoles, 5=Jueves, 6=Viernes, 7=Sábado
      // Nuestro day_of_week va de 1 (Lunes) a 5 (Viernes) -> weekday = day_of_week + 1
      const expoWeekday = item.day_of_week + 1

      // Mensaje limpio: muestra el nombre de la materia (y aula únicamente si está definida)
      const roomSuffix = item.classroom_room?.trim() ? ` • Aula ${item.classroom_room.trim()}` : ''
      const bodyText = `${item.subject.name}${roomSuffix}`

      await Notifications.scheduleNotificationAsync({
        identifier: `class_sched_${item.id || `${item.day_of_week}_${item.block_number}`}`,
        content: {
          title: 'Próxima clase en 10 min',
          body: bodyText,
          sound: true,
          data: { scheduleId: item.id, type: 'class_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday,
          hour: notifHour,
          minute: notifMin,
        },
      })
    } catch (err) {
      console.log('Error programando recordatorio de clase:', err)
    }
  }
}

/**
 * Sincroniza y reprograma todas las notificaciones de la app de forma transparente
 */
export async function syncAllNotifications(
  tasks?: Task[],
  schedules?: Schedule[],
  prefsOverride?: AppPreferences
): Promise<void> {
  try {
    const prefs = prefsOverride || (await personalStorage.getPreferences())
    const hasPermission = await requestNotificationPermissions()
    if (!hasPermission) return

    const currentTasks = tasks || (await personalStorage.getTasks())
    const currentSchedules = schedules || (await personalStorage.getSchedules())

    // 1. Programar avisos de tareas pendientes
    for (const t of currentTasks) {
      if (t.status === 'pending') {
        await scheduleTaskReminder(t, prefs)
      } else {
        await cancelTaskReminder(t.id)
      }
    }

    // 2. Programar avisos de clases
    await scheduleClassReminders(currentSchedules, prefs)
  } catch (err) {
    console.log('Error sincronizando notificaciones:', err)
  }
}
