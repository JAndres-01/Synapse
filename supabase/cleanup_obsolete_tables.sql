-- ==============================================================================
-- SYNAPSE: SCRIPT DE PURGA Y LIMPIEZA DE TABLAS OBSOLETAS
-- Ejecuta este script en el SQL Editor de tu panel de Supabase
-- ==============================================================================

-- 1. Eliminar tablas heredadas del sistema antiguo multi-usuario / salones
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.notice_comments CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;
DROP TABLE IF EXISTS public.task_attachments CASCADE;
DROP TABLE IF EXISTS public.user_task_status CASCADE;
DROP TABLE IF EXISTS public.classroom_members CASCADE;
DROP TABLE IF EXISTS public.classrooms CASCADE;

-- 2. Eliminar tipos ENUM obsoletos que ya no se utilizan
DROP TYPE IF EXISTS public.notice_category CASCADE;
DROP TYPE IF EXISTS public.attachment_type CASCADE;
DROP TYPE IF EXISTS public.task_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- 3. Limpiar columnas obsoletas si existían en subjects, schedules o tasks
DO $$ BEGIN
    ALTER TABLE public.subjects DROP COLUMN IF EXISTS classroom_id;
    ALTER TABLE public.subjects DROP COLUMN IF EXISTS links;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.schedules DROP COLUMN IF EXISTS classroom_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.tasks DROP COLUMN IF EXISTS classroom_id;
    ALTER TABLE public.tasks DROP COLUMN IF EXISTS created_by;
    ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_private;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
