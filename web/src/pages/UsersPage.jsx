import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', fullName: '', role: 'operator', password: 'rom123' });

  const load = useCallback(async () => {
    try {
      const data = await api(`/users?q=${encodeURIComponent(q)}`);
      setUsers(data.users);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e) {
    e.preventDefault();
    try {
      await api('/users', { method: 'POST', body: form });
      setForm({ email: '', fullName: '', role: 'operator', password: 'rom123' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function patch(id, body) {
    try {
      await api(`/users/${id}`, { method: 'PATCH', body });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-mist">Users</h1>
      <p className="text-sm text-mist-muted">Invite, roles, activate/deactivate</p>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <input
        className="mt-4 w-full max-w-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm"
        placeholder="Search name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <form onSubmit={createUser} className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="border border-ink-600 bg-ink-900 px-3 py-2 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="border border-ink-600 bg-ink-900 px-3 py-2 text-sm"
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <select
          className="border border-ink-600 bg-ink-900 px-3 py-2 text-sm"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="operator">operator</option>
          <option value="admin">admin</option>
          <option value="accounts">accounts</option>
        </select>
        <input
          className="border border-ink-600 bg-ink-900 px-3 py-2 text-sm"
          placeholder="Temp password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button type="submit" className="bg-blue px-3 py-2 text-sm font-semibold text-white">
          Add user
        </button>
      </form>

      <ul className="mt-8 divide-y divide-ink-700/50">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-mist">
                {u.fullName}{' '}
                {!u.active && <span className="text-xs text-mist-muted">inactive</span>}
              </p>
              <p className="text-xs text-mist-muted">
                {u.email} · {u.role}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="border border-ink-600 bg-ink-950 px-2 py-1 text-xs"
                value={u.role}
                onChange={(e) => patch(u.id, { role: e.target.value })}
              >
                <option value="operator">operator</option>
                <option value="admin">admin</option>
                <option value="accounts">accounts</option>
              </select>
              <button
                type="button"
                className="border border-ink-600 px-2 py-1 text-xs"
                onClick={() => {
                  const fullName = window.prompt('Full name', u.fullName);
                  if (fullName) patch(u.id, { fullName });
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="border border-ink-600 px-2 py-1 text-xs"
                onClick={() => patch(u.id, { active: !u.active })}
              >
                {u.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
