// Статистика считается в App по полному набору, а не по выборке:
// фильтр меняет список, но не число задач.
export default function TaskStats({ stats }) {
  return (
    <section className="panel stats" aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="visually-hidden">Статистика</h2>
      <dl>
        <div><dt>Всего</dt><dd>{stats.total}</dd></div>
        <div className="is-done"><dt>Выполнено</dt><dd>{stats.completed}</dd></div>
        <div className="is-active"><dt>В работе</dt><dd>{stats.active}</dd></div>
      </dl>
    </section>
  );
}
