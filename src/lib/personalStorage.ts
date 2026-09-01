import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Subject, Schedule, Task, PersonalProfile } from '@/types/personal'

const KEYS = {
  SUBJECTS: 'synapse_personal_subjects_v2',
  SCHEDULES: 'synapse_personal_schedules_v2',
  TASKS: 'synapse_personal_tasks_v2',
  PROFILE: 'synapse_personal_profile_v2',
}

export const personalStorage = {
  // Materias
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

  // Horarios
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

  async clearScheduleSlot(dayOfWeek: number, blockNumber: number): Promise<Schedule[]> {
    const list = await this.getSchedules()
    const updated = list.filter(
      (s) => !(s.day_of_week === dayOfWeek && s.block_number === blockNumber)
    )
    await this.setSchedules(updated)
    return updated
  },

  // Tareas
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

  async removeTask(taskId: string): Promise<Task[]> {
    const list = await this.getTasks()
    const updated = list.filter((t) => t.id !== taskId)
    await this.setTasks(updated)
    return updated
  },

  // Perfil
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

  // Modo Demo Reversible
  async loadDemoData(todayDayOfWeek: number): Promise<void> {
    const [currSubjs, currScheds, currTasks] = await Promise.all([
      this.getSubjects(),
      this.getSchedules(),
      this.getTasks(),
    ])
    const backup = {
      subjects: currSubjs,
      schedules: currScheds,
      tasks: currTasks,
      isDemo: true,
    }
    await AsyncStorage.setItem('synapse_demo_backup_v2', JSON.stringify(backup))

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const date = now.getDate()

    const demoSubjects: Subject[] = [
      {
        id: 'subj_demo_bd',
        user_id: 'local_user',
        name: 'Base de Datos II',
        teacher_name: 'Ing. Marcella Gómez',
        color: '#3B82F6',
        created_at: new Date().toISOString(),
      },
      {
        id: 'subj_demo_is',
        user_id: 'local_user',
        name: 'Ingeniería de Software',
        teacher_name: 'Dr. Roberto Silva',
        color: '#10B981',
        created_at: new Date().toISOString(),
      },
      {
        id: 'subj_demo_calc',
        user_id: 'local_user',
        name: 'Cálculo Multivariable',
        teacher_name: 'Lic. Javier Morales',
        color: '#8B5CF6',
        created_at: new Date().toISOString(),
      },
    ]

    const demoSchedules: Schedule[] = [
      {
        id: 'sched_demo_1',
        user_id: 'local_user',
        subject_id: 'subj_demo_bd',
        subject: demoSubjects[0],
        day_of_week: todayDayOfWeek,
        block_number: 1,
        start_time: '07:00',
        end_time: '08:30',
        classroom_room: 'Lab de Computo 3',
      },
      {
        id: 'sched_demo_2',
        user_id: 'local_user',
        subject_id: 'subj_demo_is',
        subject: demoSubjects[1],
        day_of_week: todayDayOfWeek,
        block_number: 2,
        start_time: '08:30',
        end_time: '10:00',
        classroom_room: 'Aula 204 - Pab. A',
      },
      {
        id: 'sched_demo_4',
        user_id: 'local_user',
        subject_id: 'subj_demo_calc',
        subject: demoSubjects[2],
        day_of_week: todayDayOfWeek,
        block_number: 4,
        start_time: '11:30',
        end_time: '13:00',
        classroom_room: 'Aula Magna 10',
      },
    ]

    const due1 = new Date(year, month, date, 8, 30, 0, 0).toISOString()
    const due2 = new Date(year, month, date, 10, 0, 0, 0).toISOString()
    const due3 = new Date(year, month, date, 13, 0, 0, 0).toISOString()

    const demoTasks: Task[] = [
      {
        id: 'task_demo_1',
        user_id: 'local_user',
        title: 'Informe de Laboratorio: Optimización y Consultas SQL',
        description: 'Subir archivo PDF con el plan de ejecución y diagramas relacionales.',
        subject_id: 'subj_demo_bd',
        subject: demoSubjects[0],
        due_date: due1,
        type: 'grupal',
        status: 'pending',
        attachments: [],
        created_at: new Date().toISOString(),
      },
      {
        id: 'task_demo_2',
        user_id: 'local_user',
        title: 'Entrega Sprint 1: Arquitectura y Modelado C4',
        description: 'Documentar microservicios y endpoints para el demo de la clase.',
        subject_id: 'subj_demo_is',
        subject: demoSubjects[1],
        due_date: due2,
        type: 'proyecto',
        status: 'pending',
        attachments: [],
        created_at: new Date().toISOString(),
      },
      {
        id: 'task_demo_3',
        user_id: 'local_user',
        title: 'Formulario de Integrales de Superficie y Teorema de Stokes',
        description: 'Repasar los ejercicios propuestos de la guía 4.',
        subject_id: 'subj_demo_calc',
        subject: demoSubjects[2],
        due_date: due3,
        type: 'individual',
        status: 'pending',
        attachments: [],
        created_at: new Date().toISOString(),
      },
    ]

    await Promise.all([
      this.setSubjects(demoSubjects),
      this.setSchedules(demoSchedules),
      this.setTasks(demoTasks),
    ])
  },

  async isDemoActive(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem('synapse_demo_backup_v2')
      return Boolean(data)
    } catch {
      return false
    }
  },

  async revertDemoData(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('synapse_demo_backup_v2')
      if (data) {
        const backup = JSON.parse(data)
        await Promise.all([
          this.setSubjects(backup.subjects || []),
          this.setSchedules(backup.schedules || []),
          this.setTasks(backup.tasks || []),
          AsyncStorage.removeItem('synapse_demo_backup_v2'),
        ])
      } else {
        const [subjs, scheds, tasks] = await Promise.all([
          this.getSubjects(),
          this.getSchedules(),
          this.getTasks(),
        ])
        await Promise.all([
          this.setSubjects(subjs.filter((s) => !s.id.startsWith('subj_demo_'))),
          this.setSchedules(scheds.filter((s) => !s.id.startsWith('sched_demo_'))),
          this.setTasks(tasks.filter((t) => !t.id.startsWith('task_demo_'))),
          AsyncStorage.removeItem('synapse_demo_backup_v2'),
        ])
      }
    } catch (err) {
      console.error('Error revirtiendo demo:', err)
    }
  },
}
