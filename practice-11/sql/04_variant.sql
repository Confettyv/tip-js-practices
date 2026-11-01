-- Вариант 1: невыполненные задачи категории «Учёба» с названием категории.
-- Ожидается: id 7, 13. Фильтр по названию, а не по id 1: так записано условие варианта.
SELECT t.id, t.title, t.priority, c.name AS category_name
FROM public.tasks AS t
JOIN public.categories AS c ON c.id = t.category_id
WHERE c.name = 'Учёба' AND NOT t.completed
ORDER BY t.id;
