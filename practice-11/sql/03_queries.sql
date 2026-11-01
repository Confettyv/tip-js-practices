-- Q1–Q7 раздела 7 методички. Только SELECT, явные колонки и ORDER BY.

-- Q1: все задачи с названием категории.
SELECT t.id, t.title, t.completed, t.priority, t.category_id, c.name AS category_name
FROM public.tasks AS t
JOIN public.categories AS c ON c.id = t.category_id
ORDER BY t.id;

-- Q2: невыполненные задачи высокого приоритета в категории 2.
SELECT t.id, t.title, t.priority, t.category_id
FROM public.tasks AS t
WHERE NOT t.completed AND t.priority = 'high' AND t.category_id = 2
ORDER BY t.id;

-- Q3: поиск ПРОВЕР без учёта регистра. Слово фиксированное, поэтому % и _ в нём не встречаются.
SELECT t.id, t.title
FROM public.tasks AS t
WHERE t.title ILIKE '%ПРОВЕР%'
ORDER BY t.id;

-- Q4: число задач в каждой категории, пустые категории дают 0.
-- LEFT JOIN сохраняет категорию без задач, count(t.id) не считает её NULL-строку.
SELECT c.id, c.name, count(t.id) AS task_count
FROM public.categories AS c
LEFT JOIN public.tasks AS t ON t.category_id = c.id
GROUP BY c.id, c.name
ORDER BY c.id;

-- Q5: выполненные и невыполненные задачи по категориям.
SELECT c.id, c.name,
       count(t.id) FILTER (WHERE t.completed)     AS done_count,
       count(t.id) FILTER (WHERE NOT t.completed) AS open_count
FROM public.categories AS c
LEFT JOIN public.tasks AS t ON t.category_id = c.id
GROUP BY c.id, c.name
ORDER BY c.id;

-- Q6: категории, в которых не менее четырёх задач.
SELECT c.id, c.name, count(t.id) AS task_count
FROM public.categories AS c
JOIN public.tasks AS t ON t.category_id = c.id
GROUP BY c.id, c.name
HAVING count(t.id) >= 4
ORDER BY c.id;

-- Q7: задача 4 в именах полей API.
SELECT t.id, t.title, t.completed, t.priority, t.category_id AS "categoryId"
FROM public.tasks AS t
WHERE t.id = 4
ORDER BY t.id;
