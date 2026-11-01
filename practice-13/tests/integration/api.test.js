import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { createFakeStore } from '../support/fake-store.js';
import { request, startServer } from '../support/http.js';

async function withApi(options, run) {
  const running = await startServer(createApp(options));
  try {
    await run(running.origin);
  } finally {
    await running.close();
  }
}

function json(value, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

test('health подтверждает БД и не раскрывает Express', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const { response, body } = await request(origin, '/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: { status: 'ok', database: 'connected' } });
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('GET списка применяет четыре фильтра', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const answer = await request(
      origin,
      '/api/tasks?completed=false&priority=high&categoryId=2&q=%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C',
    );
    assert.equal(answer.response.status, 200);
    assert.deepEqual(
      answer.body.data.map((task) => task.id),
      [4],
    );
    assert.equal(answer.body.meta.total, 1);
  });
});

test('GET по id различает неверный, отсутствующий и существующий id', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    assert.equal((await request(origin, '/api/tasks/0')).response.status, 400);
    assert.equal((await request(origin, '/api/tasks/999')).response.status, 404);
    const found = await request(origin, '/api/tasks/4');
    assert.equal(found.response.status, 200);
    assert.equal(found.body.data.title, 'Подготовить модель задач');
  });
});

test('POST → PATCH → DELETE сохраняет контракт', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const created = await request(
      origin,
      '/api/tasks',
      json({ title: '  Проверить тесты  ', priority: 'high', categoryId: 2 }),
    );
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.title, 'Проверить тесты');
    assert.equal(created.response.headers.get('location'), `/api/tasks/${created.body.data.id}`);

    const updated = await request(
      origin,
      `/api/tasks/${created.body.data.id}`,
      json({ completed: true }, 'PATCH'),
    );
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.completed, true);
    assert.equal(updated.body.data.title, 'Проверить тесты');

    const deleted = await request(origin, `/api/tasks/${created.body.data.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleted.response.status, 204);
    assert.equal(deleted.body, null);
  });
});

test('debug reset доступен только при явном включении', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    assert.equal(
      (await request(origin, '/api/debug/reset', { method: 'POST' })).response.status,
      404,
    );
  });
  await withApi({ store: createFakeStore(), enableDebugReset: true }, async (origin) => {
    const answer = await request(origin, '/api/debug/reset', { method: 'POST' });
    assert.equal(answer.response.status, 200);
    assert.deepEqual(answer.body, { data: { reset: true, total: 3 } });
  });
});

const errorCode = (answer) => answer.body?.error?.code;

test('POST отклоняет неверный media type, пустой и сломанный JSON', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const body = JSON.stringify({ title: 'A', priority: 'low', categoryId: 1 });
    const cases = [
      [{ 'Content-Type': 'text/plain' }, body, 415, 'UNSUPPORTED_MEDIA_TYPE'],
      [{}, body, 415, 'UNSUPPORTED_MEDIA_TYPE'],
      [{ 'Content-Type': 'application/json' }, '', 400, 'INVALID_JSON'],
      [{ 'Content-Type': 'application/json' }, '{"title":', 400, 'INVALID_JSON'],
    ];
    for (const [headers, payload, status, code] of cases) {
      const answer = await request(origin, '/api/tasks', {
        method: 'POST',
        headers,
        body: payload,
      });
      assert.equal(answer.response.status, status, payload);
      assert.match(answer.response.headers.get('content-type'), /application\/json/);
      assert.equal(errorCode(answer), code, payload);
    }
    assert.equal((await request(origin, '/api/tasks')).body.meta.total, 3);
  });
});

test('валидация отклоняет неизвестное поле и несуществующую категорию без изменения данных', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const before = (await request(origin, '/api/tasks/4')).body.data;

    const patch = await request(
      origin,
      '/api/tasks/4',
      json({ title: 'Взлом', owner: 'me' }, 'PATCH'),
    );
    assert.equal(patch.response.status, 400);
    assert.equal(errorCode(patch), 'VALIDATION_ERROR');
    assert.deepEqual(Object.keys(patch.body.error.details), ['owner']);
    // Допустимый title рядом с неизвестным полем тоже не применился
    assert.deepEqual((await request(origin, '/api/tasks/4')).body.data, before);

    const post = await request(
      origin,
      '/api/tasks',
      json({ title: 'A', priority: 'low', categoryId: 999 }),
    );
    assert.equal(post.response.status, 400);
    assert.ok(post.body.error.details.categoryId);
    assert.equal((await request(origin, '/api/tasks')).body.meta.total, 3);
  });
});

test('405 содержит Allow, а OPTIONS возвращает CORS-заголовки', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const put = await request(origin, '/api/tasks/4', json({ title: 'A' }, 'PUT'));
    assert.equal(put.response.status, 405);
    assert.equal(errorCode(put), 'METHOD_NOT_ALLOWED');
    assert.equal(put.response.headers.get('allow'), 'GET, HEAD, PATCH, DELETE, OPTIONS');

    const del = await request(origin, '/api/tasks', { method: 'DELETE' });
    assert.equal(del.response.status, 405);
    assert.equal(del.response.headers.get('allow'), 'GET, HEAD, POST, OPTIONS');

    const options = await request(origin, '/api/tasks/4', {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'PATCH' },
    });
    assert.equal(options.response.status, 204);
    assert.equal(options.body, null);
    assert.equal(options.response.headers.get('access-control-allow-origin'), '*');
    assert.match(options.response.headers.get('access-control-allow-methods'), /\bPATCH\b/);
    assert.match(options.response.headers.get('access-control-allow-headers'), /Content-Type/);
    assert.equal(options.response.headers.get('access-control-expose-headers'), 'Location');
  });
});

test('SQLSTATE внешнего ключа и соединения переводятся в безопасные ошибки API', async () => {
  const store = createFakeStore();
  store.createTask = async () => {
    throw Object.assign(new Error('database detail'), { code: '23503' });
  };
  store.getTask = async () => {
    throw Object.assign(new Error('database detail: host 10.0.0.5'), { code: '08006' });
  };
  store.listTasks = async () => {
    throw new Error('database detail: syntax error at or near');
  };
  await withApi({ store }, async (origin) => {
    const cases = [
      [
        await request(origin, '/api/tasks', json({ title: 'A', priority: 'low', categoryId: 1 })),
        400,
        'VALIDATION_ERROR',
      ],
      [await request(origin, '/api/tasks/4'), 503, 'DATABASE_UNAVAILABLE'],
      [await request(origin, '/api/tasks'), 500, 'INTERNAL_ERROR'],
    ];
    for (const [answer, status, code] of cases) {
      assert.equal(answer.response.status, status);
      assert.equal(errorCode(answer), code);
      const raw = JSON.stringify(answer.body);
      for (const secret of ['database detail', '23503', '08006', '10.0.0.5', 'syntax']) {
        assert.ok(!raw.includes(secret), `${status}: утечка «${secret}»`);
      }
    }
  });
});

test('гонка удаления между requireTask и PATCH возвращает 404', async () => {
  const store = createFakeStore();
  const updateTask = store.updateTask.bind(store);
  // requireTask уже нашёл запись, затем «другой запрос» удаляет её до UPDATE
  store.updateTask = async (id, changes) => {
    await store.deleteTask(id);
    return updateTask(id, changes);
  };
  await withApi({ store }, async (origin) => {
    const answer = await request(origin, '/api/tasks/4', json({ completed: true }, 'PATCH'));
    assert.equal(answer.response.status, 404);
    assert.equal(errorCode(answer), 'TASK_NOT_FOUND');
    assert.equal((await request(origin, '/api/tasks/4')).response.status, 404);
  });
});
