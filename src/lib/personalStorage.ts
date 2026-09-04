import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Subject, Schedule, Task, PersonalProfile, AppPreferences } from '@/types/personal'

const KEYS = {
  SUBJECTS: 'synapse_personal_subjects_v2',
  SCHEDULES: 'synapse_personal_schedules_v2',
  TASKS: 'synapse_personal_tasks_v2',
  PROFILE: 'synapse_personal_profile_v2',
  PREFERENCES: 'synapse_personal_prefs_v2',
}

// ==========================================
// CACHÉ EN MEMORIA (REACTIVA Y SIN LATENCIA)
// ==========================================
let _subjectsCache: Subject[] | null = null
let _schedulesCache: Schedule[] | null = null
let _tasksCache: Task[] | null = null
let _profileCache: PersonalProfile | null = null
let _preferencesCache: AppPreferences | null = null

const listeners = new Set<() => void>()

export function subscribeToPersonalStorage(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb()
    } catch (e) {
      console.error('[personalStorage] Error en listener:', e)
    }
  })
}

export const personalStorage = {
  // ==========================================
  // MÉTODOS DE ACCESO DIRECTO A CACHÉ EN MEMORIA
  // ==========================================
  getCachedSubjects(): Subject[] {
    return _subjectsCache !== null ? [..._subjectsCache] : []
  },

  getCachedSchedules(): Schedule[] {
    return _schedulesCache !== null ? [..._schedulesCache] : []
  },

  getCachedTasks(): Task[] {
    if (_tasksCache !== null) {
      return _tasksCache.filter((t) => !t.id?.startsWith('test-heatmap-') && !t.id?.startsWith('test-'))
    }
    return []
  },

  getCachedProfile(): PersonalProfile | null {
    return _profileCache !== null ? { ..._profileCache } : null
  },

  getCachedPreferences(): AppPreferences | null {
    return _preferencesCache !== null ? { ..._preferencesCache } : null
  },

  isPreloaded(): boolean {
    return _subjectsCache !== null && _schedulesCache !== null && _tasksCache !== null
  },

  async preloadAll(): Promise<void> {
    await Promise.all([
      this.getSubjects(),
      this.getSchedules(),
      this.getTasks(),
      this.getProfile(),
      this.getPreferences(),
    ])
  },

  // ==========================================
  // MATERIAS (SUBJECTS)
  // ==========================================
  async getSubjects(): Promise<Subject[]> {
    if (_subjectsCache !== null) {
      return [..._subjectsCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.SUBJECTS)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _subjectsCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      console.error('[personalStorage] Error leyendo materias:', err)
    }
    _subjectsCache = []
    return []
  },

  async setSubjects(subjects: Subject[]): Promise<void> {
    const safeList = Array.isArray(subjects) ? subjects : []
    _subjectsCache = [...safeList]
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(safeList))
    } catch (err) {
      console.error('[personalStorage] Error guardando materias:', err)
    }
  },

  async saveSubject(subject: Subject): Promise<Subject[]> {
    const list = await this.getSubjects()
    const index = list.findIndex((s) => s.id === subject.id)
    let updated: Subject[]
    if (index >= 0) {
      updated = [...list]
      updated[index] = subject
    } else {
      updated = [...list, subject]
    }
    await this.setSubjects(updated)
    return updated
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
    if (_schedulesCache !== null) {
      return [..._schedulesCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.SCHEDULES)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _schedulesCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      console.error('[personalStorage] Error leyendo horarios:', err)
    }
    _schedulesCache = []
    return []
  },

  async setSchedules(schedules: Schedule[]): Promise<void> {
    const safeList = Array.isArray(schedules) ? schedules : []
    _schedulesCache = [...safeList]
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.SCHEDULES, JSON.stringify(safeList))
    } catch (err) {
      console.error('[personalStorage] Error guardando horarios:', err)
    }
  },

  async saveScheduleSlot(schedule: Schedule): Promise<Schedule[]> {
    const list = await this.getSchedules()
    const index = list.findIndex(
      (s) => s.day_of_week === schedule.day_of_week && s.block_number === schedule.block_number
    )
    let updated: Schedule[]
    if (index >= 0) {
      updated = [...list]
      updated[index] = schedule
    } else {
      updated = [...list, schedule]
    }
    await this.setSchedules(updated)
    return updated
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
    if (_tasksCache !== null) {
      if (_tasksCache.some((t) => t.id?.startsWith('test-heatmap-') || t.id?.startsWith('test-'))) {
        const cleaned = _tasksCache.filter((t) => !t.id?.startsWith('test-heatmap-') && !t.id?.startsWith('test-'))
        _tasksCache = cleaned
        this.setTasks(cleaned)
      }
      return [..._tasksCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.TASKS)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((t) => !t.id?.startsWith('test-heatmap-') && !t.id?.startsWith('test-'))
          _tasksCache = cleaned
          if (cleaned.length !== parsed.length) {
            await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(cleaned))
          }
          return [...cleaned]
        }
      }
    } catch (err) {
      console.error('[personalStorage] Error leyendo tareas:', err)
    }
    _tasksCache = []
    return []
  },

  async setTasks(tasks: Task[]): Promise<void> {
    const safeList = Array.isArray(tasks) ? tasks : []
    _tasksCache = [...safeList]
    notifyListeners()
    try {
      // Optimizar para almacenamiento persistente: omitir objeto anidado redundante 'subject'
      const storageList = safeList.map((t) => {
        const { subject, ...rest } = t
        return rest
      })
      await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(storageList))
    } catch (err) {
      console.error('[personalStorage] Error guardando tareas:', err)
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.setTasks(tasks)
  },

  async saveTask(task: Task): Promise<Task[]> {
    const list = await this.getTasks()
    const index = list.findIndex((t) => t.id === task.id)
    let updated: Task[]
    if (index >= 0) {
      updated = [...list]
      updated[index] = task
    } else {
      updated = [task, ...list]
    }
    await this.setTasks(updated)
    return updated
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
  // PERFIL LOCAL (PROFILE)
  // ==========================================
  async getProfile(): Promise<PersonalProfile> {
    if (_profileCache !== null) {
      return { ..._profileCache }
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.PROFILE)
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed && typeof parsed === 'object') {
          _profileCache = parsed
          return { ...parsed }
        }
      }
    } catch {}
    const defaultProfile: PersonalProfile = {
      id: 'local_user',
      full_name: 'Estudiante',
      email: '',
      theme: 'dark',
      created_at: new Date().toISOString(),
    }
    await this.setProfile(defaultProfile)
    return defaultProfile
  },

  async setProfile(profile: PersonalProfile): Promise<void> {
    _profileCache = { ...profile }
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile))
    } catch (err) {
      console.error('[personalStorage] Error guardando perfil:', err)
    }
  },

  // ==========================================
  // PREFERENCIAS (PREFERENCES)
  // ==========================================
  async getPreferences(): Promise<AppPreferences> {
    if (_preferencesCache !== null) {
      return { ..._preferencesCache }
    }
    try {
      const currentYear = new Date().getFullYear()
      const data = await AsyncStorage.getItem(KEYS.PREFERENCES)
      const parsed = data ? JSON.parse(data) : {}
      const prefs: AppPreferences = {
        haptics_enabled: parsed.haptics_enabled ?? true,
        confetti_enabled: parsed.confetti_enabled ?? true,
        advance_reminder_enabled: parsed.advance_reminder_enabled ?? true,
        advance_reminder_time: parsed.advance_reminder_time || '20:00',
        class_reminder_enabled: parsed.class_reminder_enabled ?? true,
        semester_fall_start: parsed.semester_fall_start || `${currentYear}-08-01`,
        semester_fall_end: parsed.semester_fall_end || `${currentYear}-12-31`,
        semester_spring_start: parsed.semester_spring_start || `${currentYear}-02-01`,
        semester_spring_end: parsed.semester_spring_end || `${currentYear}-06-30`,
      }
      _preferencesCache = prefs
      return prefs
    } catch {
      const currentYear = new Date().getFullYear()
      const defaultPrefs: AppPreferences = {
        haptics_enabled: true,
        confetti_enabled: true,
        advance_reminder_enabled: true,
        advance_reminder_time: '20:00',
        class_reminder_enabled: true,
        semester_fall_start: `${currentYear}-08-01`,
        semester_fall_end: `${currentYear}-12-31`,
        semester_spring_start: `${currentYear}-02-01`,
        semester_spring_end: `${currentYear}-06-30`,
      }
      _preferencesCache = defaultPrefs
      return defaultPrefs
    }
  },

  async setPreferences(prefs: AppPreferences): Promise<void> {
    _preferencesCache = { ...prefs }
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(prefs))
    } catch (err) {
      console.error('[personalStorage] Error guardando preferencias:', err)
    }
  },

  // ==========================================
  // COPIAS DE SEGURIDAD (BACKUP / RESTORE)
  // ==========================================
  async exportBackup(): Promise<string> {
    const [subjects, schedules, tasks, profile, preferences] = await Promise.all([
      this.getSubjects(),
      this.getSchedules(),
      this.getTasks(),
      this.getProfile(),
      this.getPreferences(),
    ])
    return JSON.stringify(
      {
        app: 'Synapse',
        version: '2.0-local',
        exported_at: new Date().toISOString(),
        subjects,
        schedules,
        tasks,
        profile,
        preferences,
      },
      null,
      2
    )
  },

  async importBackup(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString)
      if (Array.isArray(data.subjects)) await this.setSubjects(data.subjects)
      if (Array.isArray(data.schedules)) await this.setSchedules(data.schedules)
      if (Array.isArray(data.tasks)) await this.setTasks(data.tasks)
      if (data.profile) await this.setProfile(data.profile)
      if (data.preferences) await this.setPreferences(data.preferences)
      return true
    } catch {
      return false
    }
  },

  async clearAll(): Promise<void> {
    _subjectsCache = []
    _schedulesCache = []
    _tasksCache = []
    _profileCache = null
    _preferencesCache = null
    notifyListeners()
    try {
      await AsyncStorage.multiRemove([
        KEYS.SUBJECTS,
        KEYS.SCHEDULES,
        KEYS.TASKS,
        KEYS.PROFILE,
        KEYS.PREFERENCES,
      ])
    } catch (err) {
      console.error('[personalStorage] Error limpiando storage:', err)
    }
  },
}
