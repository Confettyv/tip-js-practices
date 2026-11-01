import { buildListTasksQuery, buildUpdateTaskQuery, taskColumns } from './query-builders.js';

const noFilters = { completed: null, priority: null, categoryId: null, q: '' };

// Исходные данные те же, что в sql/02_seed.sql. Хранятся столбцами: каждый
// столбец уходит одним массивом-параметром в unnest(), без склейки SQL.
const seedCategories = {
  ids: [1, 2, 3],
  names: ['Учёба', 'Проект', 'Организация'],
};
const seedTasks = {
  ids: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  titles: [
    'Изучить функции', 'Подготовить модель задач', 'Проверить методы массивов',
    'Оформить README', 'Разобрать Promise', 'Проверить учебный API',
    'Описать контракт запросов', 'Подготовить демонстрацию', 'Исправить обработку ошибок',
    'Добавить фильтры API', 'Сверить отчёт', 'Провести рефакторинг клиента',
  ],
  completed: [true, false, false, true, false, true, false, false, true, false, true, false],
  priorities: ['medium', 'high', 'low', 'medium', 'high', 'high', 'medium', 'low', 'high', 'medium', 'low', 'high'],
  categoryIds: [1, 2, 1, 3, 1, 2, 3, 2, 2, 2, 3, 2],
};

// После вставки явных id identity-последовательность сама не сдвигается:
// без setval следующий INSERT получил бы id 1 и упал на первичном ключе.
const syncSequence = table => `SELECT setval(
  pg_get_serial_sequence('public.${table}', 'id'),
  (SELECT max(id) FROM public.${table}),
  true
)`;

export function createPostgresStore(pool) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('Требуется пул PostgreSQL.');

  return {
    async ping() {
      const result = await pool.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    },

    async listCategories() {
      const result = await pool.query('SELECT id, name FROM public.categories ORDER BY id');
      return result.rows;
    },

    async listTasks(filters = noFilters) {
      const query = buildListTasksQuery(filters);
      const result = await pool.query(query);
      return result.rows;
    },

    async getTask(id) {
      const result = await pool.query(`SELECT ${taskColumns}\n  FROM public.tasks\n  WHERE id = $1`, [id]);
      return result.rows[0] ?? null;
    },

    async createTask(value) {
      // completed не передаём: значение по умолчанию назначает DEFAULT false в схеме
      const result = await pool.query(
        `INSERT INTO public.tasks (title, priority, category_id)\n  VALUES ($1, $2, $3)\n  RETURNING ${taskColumns}`,
        [value.title, value.priority, value.categoryId],
      );
      return result.rows[0];
    },

    async updateTask(id, changes) {
      // Пустой RETURNING означает, что строку удалили между проверкой и записью
      const result = await pool.query(buildUpdateTaskQuery(id, changes));
      return result.rows[0] ?? null;
    },

    async deleteTask(id) {
      const result = await pool.query('DELETE FROM public.tasks WHERE id = $1', [id]);
      return result.rowCount === 1;
    },

    async reset() {
      // Транзакция живёт в соединении: pool.query мог бы отдать каждую
      // команду разному соединению, поэтому всё идёт через один client.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Сначала задачи: FK с ON DELETE RESTRICT не даст удалить категории раньше
        await client.query('DELETE FROM public.tasks');
        await client.query('DELETE FROM public.categories');
        await client.query(
          `INSERT INTO public.categories (id, name)\n  SELECT * FROM unnest($1::integer[], $2::text[])`,
          [seedCategories.ids, seedCategories.names],
        );
        await client.query(
          `INSERT INTO public.tasks (id, title, completed, priority, category_id)
  SELECT * FROM unnest($1::integer[], $2::text[], $3::boolean[], $4::text[], $5::integer[])`,
          [seedTasks.ids, seedTasks.titles, seedTasks.completed, seedTasks.priorities, seedTasks.categoryIds],
        );
        await client.query(syncSequence('categories'));
        await client.query(syncSequence('tasks'));
        await client.query('COMMIT');
        return { reset: true, total: seedTasks.ids.length };
      } catch (error) {
        // Ошибка самого ROLLBACK не должна скрыть исходную причину
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
