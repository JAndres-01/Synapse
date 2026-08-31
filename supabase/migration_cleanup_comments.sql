-- ========================================================================
-- SYNAPSE: MIGRACIÓN DE LIMPIEZA - ELIMINACIÓN DE LA TABLA DE COMENTARIOS
-- ========================================================================
-- Ejecuta este script en el SQL Editor de Supabase (Dashboard -> SQL Editor)

-- 1. Eliminar tabla de comentarios y todas sus políticas e índices dependientes
DROP TABLE IF EXISTS public.task_comments CASCADE;

-- 2. Asegurar que las tablas de tareas y adjuntos permanezcan óptimas
ANALYZE public.tasks;
ANALYZE public.task_attachments;
