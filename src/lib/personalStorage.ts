import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Subject, Schedule, Task, PersonalProfile } from '@/types/personal'

const KEYS = {
  PROFILE: 'synapse_personal_profile',
  SUBJECTS: 'synapse_personal_subjects',
  SCHEDULES: 'synapse_personal_schedules',
  TASKS: 'synapse_personal_tasks',
}

export const personalStorage = {
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
    } catch {}
  },

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
    } catch {}
  },

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
    } catch {}
  },

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
    } catch {}
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([KEYS.PROFILE, KEYS.SUBJECTS, KEYS.SCHEDULES, KEYS.TASKS])
    } catch {}
  },
}
