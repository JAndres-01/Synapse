export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'student' | 'admin'
export type TaskType = 'individual' | 'grupal' | 'proyecto' | 'examen'
export type NoticeCategory = 'cambio_aula' | 'aviso_general' | 'evento_escolar'
export type AttachmentType = 'image' | 'pdf' | 'link'
export type TaskStatus = 'pending' | 'completed'

export interface SubjectLink {
  title: string
  url: string
  type: 'whatsapp' | 'drive' | 'classroom' | 'meet' | 'other'
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Classroom {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  created_at: string
}

export interface ClassroomMember {
  id: string
  classroom_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}

export interface Subject {
  id: string
  classroom_id: string
  name: string
  code: string | null
  teacher_name: string | null
  color: string
  links: SubjectLink[]
  created_at: string
}

export interface Schedule {
  id: string
  classroom_id: string
  subject_id: string
  block_number: number // 1, 2, 3, 4
  day_of_week: number // 1..7 (1=Lunes, 2=Martes...)
  start_time: string // "07:00:00"
  end_time: string // "08:30:00"
  classroom_room: string
  is_virtual: boolean
  subject?: Subject
}

export interface Task {
  id: string
  classroom_id: string
  subject_id: string
  title: string
  description: string | null
  type: TaskType
  due_date: string
  created_by: string | null
  created_at: string
  subject?: Subject
  attachments?: TaskAttachment[]
  user_status?: UserTaskStatus[]
}

export interface TaskAttachment {
  id: string
  task_id: string
  uploaded_by: string
  file_type: AttachmentType
  file_url: string
  file_name: string
  created_at: string
  uploader?: Profile
}

export interface UserTaskStatus {
  id: string
  user_id: string
  task_id: string
  status: TaskStatus
  completed_at: string | null
}

export interface Notice {
  id: string
  classroom_id: string
  author_id: string
  category: NoticeCategory
  content: string
  is_urgent: boolean
  created_at: string
  author?: Profile
  comments?: NoticeComment[]
}

export interface NoticeComment {
  id: string
  notice_id: string
  author_id: string
  content: string
  created_at: string
  author?: Profile
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  keys: Json
  created_at: string
}
