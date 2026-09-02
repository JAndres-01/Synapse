-- ==============================================================================
-- SYNAPSE: MIGRACIÓN DE FASE 5 (TAREAS, HILOS DE DISCUSIÓN, DOCUMENTOS Y FOTOS)
-- ==============================================================================

-- 1. Añadir columna is_private a la tabla tasks (para tareas personales de alumnos)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Permitir que subject_id sea opcional (para pendientes generales sin materia)
ALTER TABLE public.tasks 
ALTER COLUMN subject_id DROP NOT NULL;

-- 3. Crear tabla de comentarios e hilos de discusión para tareas (task_comments)
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    file_name TEXT,
    file_type attachment_type DEFAULT 'image',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS file_type attachment_type DEFAULT 'image';

-- 4. Índice para rendimiento de hilos de comentarios
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at ASC);

-- 5. Habilitar Seguridad Row Level Security (RLS) en task_comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acceso para task_comments
DROP POLICY IF EXISTS "Todos los miembros pueden ver comentarios de tareas" ON public.task_comments;
CREATE POLICY "Todos los miembros pueden ver comentarios de tareas"
    ON public.task_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden comentar en tareas" ON public.task_comments;
CREATE POLICY "Usuarios autenticados pueden comentar en tareas"
    ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "El autor puede eliminar su comentario" ON public.task_comments;
CREATE POLICY "El autor puede eliminar su comentario"
    ON public.task_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- 7. Actualizar políticas de TASKS para respetar privacidad de pendientes
DROP POLICY IF EXISTS "Todos pueden ver tareas" ON public.tasks;
CREATE POLICY "Todos pueden ver tareas del salon y sus propios pendientes"
    ON public.tasks FOR SELECT TO authenticated 
    USING (is_private = FALSE OR created_by = auth.uid());

DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tareas" ON public.tasks;
CREATE POLICY "Usuarios autenticados pueden crear tareas"
    ON public.tasks FOR INSERT TO authenticated 
    WITH CHECK (auth.role() = 'authenticated');
