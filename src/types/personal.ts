export interface PersonalProfile {
  id: string
  email: string
  full_name: string
  avatar_url?: string | null
  created_at?: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  code?: string | null
  teacher_name?: string | null
  color: string
  classroom_room?: string | null
  created_at?: string
}

export interface Schedule {
  id: string
  user_id: string
  day_of_week: number // 1: Lun, 2: Mar, 3: Mié, 4: Jue, 5: Vie
  block_number: number // 1, 2, 3, 4
  subject_id: string | null
  start_time: string
  end_time: string
  classroom_room?: string | null
  is_virtual?: boolean
  created_at?: string
  updated_at?: string
  subject?: Subject | null
}

export type TaskType = 'individual' | 'grupal' | 'proyecto' | 'examen'
export type TaskStatus = 'pending' | 'completed'

export interface TaskAttachment {
  id: string
  file_name: string
  file_url: string
  file_type: 'image' | 'link' | 'document'
  size_bytes?: number
}

export interface Task {
  id: string
  user_id: string
  subject_id?: string | null
  title: string
  description?: string | null
  type: TaskType
  status: TaskStatus
  due_date?: string | null
  attachments: TaskAttachment[]
  created_at?: string
  updated_at?: string
  subject?: Subject | null
}
