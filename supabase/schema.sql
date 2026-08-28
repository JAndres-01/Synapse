-- ==============================================================================
-- SYNAPSE: ESQUEMA DE BASE DE DATOS SUPABASE (PostgreSQL)
-- Versión: 1.0 (Producción)
-- ==============================================================================

-- Habilitar extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TIPOS ENUM PERSONALIZADOS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('individual', 'grupal', 'proyecto', 'examen');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notice_category AS ENUM ('cambio_aula', 'aviso_general', 'evento_escolar');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attachment_type AS ENUM ('image', 'pdf', 'link');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLA: PROFILES (Perfiles de usuarios vinculados a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: CLASSROOMS (Salones de clase)
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA: CLASSROOM_MEMBERS (Membresía de alumnos al salón)
CREATE TABLE IF NOT EXISTS public.classroom_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_classroom UNIQUE (classroom_id, user_id)
);

-- 5. TABLA: SUBJECTS (Materias del salón)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    teacher_name TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    links JSONB DEFAULT '[]'::jsonb, -- Enlaces a WhatsApp, Drive, Classroom, Meet
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLA: SCHEDULES (Horario de los 4 bloques de 90 min)
-- Bloques: 1=07:00-08:30, 2=08:30-10:00, 3=10:00-11:30, 4=11:30-13:00
-- Días: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    block_number INT NOT NULL CHECK (block_number BETWEEN 1 AND 4),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    classroom_room TEXT DEFAULT 'Aula Principal',
    is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_schedule_slot UNIQUE (classroom_id, day_of_week, block_number)
);

-- 7. TABLA: TASKS (Tareas, proyectos y exámenes del salón + pendientes personales)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type task_type NOT NULL DEFAULT 'individual',
    due_date TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLA: TASK_COMMENTS (Hilos de respuestas y fotos de apuntes / pizarra)
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLA: TASK_ATTACHMENTS (Archivos adjuntos)
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_type attachment_type NOT NULL DEFAULT 'image',
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLA: USER_TASK_STATUS (Seguimiento personal de tareas por alumno)
CREATE TABLE IF NOT EXISTS public.user_task_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    status task_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    CONSTRAINT unique_user_task_status UNIQUE (user_id, task_id)
);

-- 10. TABLA: NOTICES (Feed de avisos oficiales de delegados)
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category notice_category NOT NULL DEFAULT 'aviso_general',
    content TEXT NOT NULL,
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABLA: NOTICE_COMMENTS (Hilos de respuestas en avisos)
CREATE TABLE IF NOT EXISTS public.notice_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABLA: PUSH_SUBSCRIPTIONS (Suscripciones Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 13. ÍNDICES PARA ALTO RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_classroom ON public.classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON public.classroom_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_classroom ON public.subjects(classroom_id);
CREATE INDEX IF NOT EXISTS idx_schedules_lookup ON public.schedules(classroom_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(classroom_id, due_date);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_status ON public.user_task_status(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_notices_classroom ON public.notices(classroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notice_comments_notice ON public.notice_comments(notice_id, created_at ASC);

-- ==============================================================================
-- 14. TRIGGER AUTOMÁTICO: CREAR PERFIL AL REGISTRARSE EN AUTH.USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', null),
        'student'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 15. POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas para PROFILES
CREATE POLICY "Los usuarios autenticados pueden ver todos los perfiles"
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Políticas para CLASSROOMS
CREATE POLICY "Cualquier usuario autenticado puede ver salones"
    ON public.classrooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Los usuarios autenticados pueden crear salones"
    ON public.classrooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Solo administradores pueden editar su salón"
    ON public.classrooms FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Políticas para CLASSROOM_MEMBERS
CREATE POLICY "Miembros pueden ver otros miembros de su salón"
    ON public.classroom_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios pueden unirse a un salón"
    ON public.classroom_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden salir de un salón"
    ON public.classroom_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Políticas para SUBJECTS
CREATE POLICY "Miembros autenticados pueden ver materias"
    ON public.subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden crear materias"
    ON public.subjects FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar materias"
    ON public.subjects FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar materias"
    ON public.subjects FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Políticas para SCHEDULES
CREATE POLICY "Todos pueden ver horarios"
    ON public.schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar horarios"
    ON public.schedules FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar horarios"
    ON public.schedules FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar horarios"
    ON public.schedules FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Políticas para TASKS
CREATE POLICY "Todos pueden ver tareas"
    ON public.tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden crear tareas"
    ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creador o delegado puede actualizar tareas"
    ON public.tasks FOR UPDATE TO authenticated USING (auth.role() = 'authenticated');

CREATE POLICY "Creador o delegado puede eliminar tareas"
    ON public.tasks FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Políticas para TASK_ATTACHMENTS (Fotos de pizarra y archivos colaborativos)
CREATE POLICY "Todos los miembros pueden ver adjuntos de tareas"
    ON public.task_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cualquier alumno o delegado puede subir adjuntos a tareas"
    ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "El usuario que subió el adjunto puede eliminarlo"
    ON public.task_attachments FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Políticas para USER_TASK_STATUS (Estado privado de cada estudiante)
CREATE POLICY "Cada estudiante ve su propio estado de tareas"
    ON public.user_task_status FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Cada estudiante puede insertar su estado de tarea"
    ON public.user_task_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Cada estudiante puede actualizar su estado de tarea"
    ON public.user_task_status FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Políticas para NOTICES (Feed de avisos)
CREATE POLICY "Todos los miembros pueden ver avisos"
    ON public.notices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden publicar avisos"
    ON public.notices FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "El autor puede eliminar su aviso"
    ON public.notices FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Políticas para NOTICE_COMMENTS (Comentarios en hilos)
CREATE POLICY "Todos pueden ver comentarios de avisos"
    ON public.notice_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios pueden comentar en avisos"
    ON public.notice_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "El autor puede eliminar su comentario"
    ON public.notice_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Políticas para PUSH_SUBSCRIPTIONS
CREATE POLICY "Usuarios gestionan sus propias suscripciones push"
    ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ==============================================================================
-- 16. CONFIGURACIÓN DEL STORAGE BUCKET PARA FOTOS DE PIZARRA Y DOCUMENTOS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('synapse_attachments', 'synapse_attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Cualquier usuario autenticado puede ver fotos y archivos de tareas"
    ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'synapse_attachments');

CREATE POLICY "Cualquier usuario autenticado puede subir fotos de pizarra y archivos"
    ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'synapse_attachments');

CREATE POLICY "El propietario del archivo puede eliminarlo"
    ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'synapse_attachments' AND auth.uid() = owner);
