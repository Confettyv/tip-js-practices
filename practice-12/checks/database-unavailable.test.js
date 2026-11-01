// Регрессия ПР12: ошибки подключения приходят от драйвера pg и Node, а не
// от PostgreSQL, поэтому у них нет SQLSTATE класса 08. Раньше они давали 500.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createFakeStore } from './support/fake-store.js';
import { request, startServer } from './support/http.js';

const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
const failures = [
  ['сервер не принимает соединения', refused],
  ['таймаут пула', new Error('timeout exceeded when trying to connect')],
  ['обрыв соединения', new Error('Connection terminated unexpectedly')],
];

for (const [name, failure] of failures) {
  test(`недоступная база → 503 без подробностей: ${name}`, async t => {
    const store = createFakeStore();
    store.ping = async () => { throw failure; };
    const server = await startServer(createApp({ store }));
    t.after(() => server.close());

    const { response, body } = await request(server.origin, '/api/health');
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(body), /ECONNREFUSED|5432|timeout|terminated/i);
  });
}
