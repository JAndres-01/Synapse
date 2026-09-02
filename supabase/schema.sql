-- ==============================================================================
-- SYNAPSE PERSONAL: ESQUEMA OFICIAL DE BASE DE DATOS (Supabase PostgreSQL)
-- Versión: 2.0 (Arquitectura Personalizada Limpia)
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: PROFILES (Perfiles de usuario)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Estudiante',
    avatar_url TEXT,
    theme TEXT NOT NULL DEFAULT 'dark',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: SUBJECTS (Materias personales del alumno)
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT DEFAULT '',
    teacher_name TEXT DEFAULT '',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    classroom_room TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA: SCHEDULES (Horarios semanales del alumno)
CREATE TABLE IF NOT EXISTS public.schedules (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    block_number INT NOT NULL CHECK (block_number BETWEEN 1 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    classroom_room TEXT DEFAULT '',
    is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_user_slot UNIQUE (user_id, day_of_week, block_number)
);

-- 5. TABLA: TASKS (Tareas y proyectos personales)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'individual',
    due_date TIMESTAMPTZ NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ÍNDICES DE ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_subjects_user ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user ON public.schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_date ASC);

-- 7. SEGURIDAD ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: PROFILES
DROP POLICY IF EXISTS "Usuarios acceden a su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios acceden a su propio perfil" ON public.profiles
    FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- POLÍTICAS: SUBJECTS
DROP POLICY IF EXISTS "Usuarios gestionan sus propias materias" ON public.subjects;
CREATE POLICY "Usuarios gestionan sus propias materias" ON public.subjects
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- POLÍTICAS: SCHEDULES
DROP POLICY IF EXISTS "Usuarios gestionan sus propios horarios" ON public.schedules;
CREATE POLICY "Usuarios gestionan sus propios horarios" ON public.schedules
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- POLÍTICAS: TASKS
DROP POLICY IF EXISTS "Usuarios gestionan sus propias tareas" ON public.tasks;
CREATE POLICY "Usuarios gestionan sus propias tareas" ON public.tasks
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
