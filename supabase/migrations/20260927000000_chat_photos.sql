-- Фото в чаті помічника: саме фото йде лише в запит до моделі й не зберігається,
-- у розмові лишається позначка, що до запитання було фото. Безпечно виконати повторно.
alter table public.assistant_messages add column if not exists has_photo boolean not null default false;
