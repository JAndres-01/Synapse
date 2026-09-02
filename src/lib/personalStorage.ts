import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Subject, Schedule, Task, PersonalProfile, AppPreferences } from '@/types/personal'

const KEYS = {
  SUBJECTS: 'synapse_personal_subjects_v2',
  SCHEDULES: 'synapse_personal_schedules_v2',
  TASKS: 'synapse_personal_tasks_v2',
  PROFILE: 'synapse_personal_profile_v2',
  PREFERENCES: 'synapse_personal_prefs_v2',
}

export const personalStorage = {
  // ==========================================
  // MATERIAS (SUBJECTS)
  // ==========================================
  async getSubjects(): Promise<Subject[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SUBJECTS)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  async setSubjects(subjects: Subject[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(subjects))
    } catch (err) {
      console.error('Error guardando materias en storage:', err)
    }
  },

  async saveSubject(subject: Subject): Promise<Subject[]> {
    const list = await this.getSubjects()
    const index = list.findIndex((s) => s.id === subject.id)
    if (index >= 0) {
      list[index] = subject
    } else {
      list.push(subject)
    }
    await this.setSubjects(list)
    return list
  },

  async addSubject(subject: Subject): Promise<Subject[]> {
    return this.saveSubject(subject)
  },

  async updateSubject(subject: Subject): Promise<Subject[]> {
    return this.saveSubject(subject)
  },

  async removeSubject(subjectId: string): Promise<Subject[]> {
    const list = await this.getSubjects()
    const updated = list.filter((s) => s.id !== subjectId)
    await this.setSubjects(updated)

    // Eliminar también de horarios
    const scheds = await this.getSchedules()
    const updatedScheds = scheds.filter((s) => s.subject_id !== subjectId)
    await this.setSchedules(updatedScheds)

    // Desvincular de las tareas (pasan a ser "General" / sin materia)
    const tasks = await this.getTasks()
    const updatedTasks = tasks.map((t) => {
      if (t.subject_id === subjectId) {
        return {
          ...t,
          subject_id: null,
          subject: null,
        }
      }
      return t
    })
    await this.setTasks(updatedTasks)

    return updated
  },

  async deleteSubject(subjectId: string): Promise<Subject[]> {
    return this.removeSubject(subjectId)
  },

  // ==========================================
  // HORARIOS (SCHEDULES)
  // ==========================================
  async getSchedules(): Promise<Schedule[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SCHEDULES)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  async setSchedules(schedules: Schedule[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SCHEDULES, JSON.stringify(schedules))
    } catch (err) {
      console.error('Error guardando horarios en storage:', err)
    }
  },

  async saveScheduleSlot(schedule: Schedule): Promise<Schedule[]> {
    const list = await this.getSchedules()
    const index = list.findIndex(
      (s) => s.day_of_week === schedule.day_of_week && s.block_number === schedule.block_number
    )
    if (index >= 0) {
      list[index] = schedule
    } else {
      list.push(schedule)
    }
    await this.setSchedules(list)
    return list
  },

  async setScheduleSlot(schedule: Schedule): Promise<Schedule[]> {
    return this.saveScheduleSlot(schedule)
  },

  async clearScheduleSlot(dayOfWeek: number, blockNumber: number): Promise<Schedule[]> {
    const list = await this.getSchedules()
    const updated = list.filter(
      (s) => !(s.day_of_week === dayOfWeek && s.block_number === blockNumber)
    )
    await this.setSchedules(updated)
    return updated
  },

  async deleteScheduleSlot(dayOfWeek: number, blockNumber: number): Promise<Schedule[]> {
    return this.clearScheduleSlot(dayOfWeek, blockNumber)
  },

  // ==========================================
  // TAREAS (TASKS)
  // ==========================================
  async getTasks(): Promise<Task[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.TASKS)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  async setTasks(tasks: Task[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks))
    } catch (err) {
      console.error('Error guardando tareas en storage:', err)
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.setTasks(tasks)
  },

  async saveTask(task: Task): Promise<Task[]> {
    const list = await this.getTasks()
    const index = list.findIndex((t) => t.id === task.id)
    if (index >= 0) {
      list[index] = task
    } else {
      list.unshift(task)
    }
    await this.setTasks(list)
    return list
  },

  async addTask(task: Task): Promise<Task[]> {
    return this.saveTask(task)
  },

  async updateTask(task: Task): Promise<Task[]> {
    return this.saveTask(task)
  },

  async removeTask(taskId: string): Promise<Task[]> {
    const list = await this.getTasks()
    const updated = list.filter((t) => t.id !== taskId)
    await this.setTasks(updated)
    return updated
  },

  async deleteTask(taskId: string): Promise<Task[]> {
    return this.removeTask(taskId)
  },

  // ==========================================
  // PERFIL (PROFILE)
  // ==========================================
  async getProfile(): Promise<PersonalProfile | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PROFILE)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  },

  async setProfile(profile: PersonalProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile))
    } catch (err) {
      console.error('Error guardando perfil en storage:', err)
    }
  },

  // ==========================================
  // PREFERENCIAS (PREFERENCES)
  // ==========================================
  async getPreferences(): Promise<AppPreferences> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PREFERENCES)
      const parsed = data ? JSON.parse(data) : {}
      return {
        haptics_enabled: parsed.haptics_enabled ?? true,
        confetti_enabled: parsed.confetti_enabled ?? true,
        advance_reminder_enabled: parsed.advance_reminder_enabled ?? true,
        advance_reminder_time: parsed.advance_reminder_time || '20:00',
        class_reminder_enabled: parsed.class_reminder_enabled ?? true,
      }
    } catch {
      return {
        haptics_enabled: true,
        confetti_enabled: true,
        advance_reminder_enabled: true,
        advance_reminder_time: '20:00',
        class_reminder_enabled: true,
      }
    }
  },

  async setPreferences(prefs: AppPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(prefs))
    } catch (err) {
      console.error('Error guardando preferencias en storage:', err)
    }
  },
}
