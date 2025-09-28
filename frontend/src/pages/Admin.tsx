import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
import Banner from '@/components/Banner';
import { AdminUserSummary, fetchAdminUsers, updateUserRole } from '@/services/api';

const AdminPage = () => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) {
      return users;
    }
    const q = query.trim().toLowerCase();
    return users.filter((user) => user.email.toLowerCase().includes(q));
  }, [users, query]);

  const metrics = useMemo(() => {
    const active = filteredUsers.filter((user) => user.status.toLowerCase() === 'active');
    const monthlyRecurring = active.reduce((acc, user) => acc + (user.monthly_fee ?? 0), 0);
    const trial = filteredUsers.filter((user) => user.status.toLowerCase() === 'trial').length;
    const totalVolume = filteredUsers.reduce((acc, user) => acc + (user.volume ?? 0), 0);
    const premium = filteredUsers.filter((user) => user.role === 'premium').length;
    return {
      accounts: filteredUsers.length,
      monthlyRecurring,
      trial,
      totalVolume,
      premium,
    };
  }, [filteredUsers]);

  const handleRoleChange = (id: number, nextRole: string) => {
    setPendingRoles((prev) => ({ ...prev, [id]: nextRole }));
  };

  const persistRole = async (id: number) => {
    const role = pendingRoles[id];
    if (!role || role.trim() === '') {
      return;
    }
    setSavingId(id);
    setActionError(null);
    try {
      await updateUserRole(id, role);
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      setActionError(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleQuickRole = async (id: number, role: 'user' | 'premium' | 'admin') => {
    setPendingRoles((prev) => ({ ...prev, [id]: role }));
    await persistRole(id);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        description="Track member subscriptions, revenue, and trading activity."
      />

      {loading && <Spinner />}
      {error && <Banner tone="error">{error}</Banner>}
      {!loading && actionError && <Banner tone="error">{actionError}</Banner>}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-400">Accounts</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metrics.accounts}</p>
            </Card>
            <Card className="bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-400">Monthly recurring</p>
              <p className="mt-2 text-2xl font-semibold text-white">${metrics.monthlyRecurring.toFixed(2)}</p>
            </Card>
            <Card className="bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active trials</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metrics.trial}</p>
            </Card>
            <Card className="bg-slate-900/70">
              <p className="text-xs uppercase tracking-wide text-slate-400">Premium accounts</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metrics.premium}</p>
            </Card>
          </div>

          <Card className="bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Members</h2>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                  {filteredUsers.length} accounts · {metrics.trial} trials
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search email"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Monthly fee</th>
                    <th className="px-3 py-2">Trade count</th>
                    <th className="px-3 py-2">Volume</th>
                    <th className="px-3 py-2">Next renewal</th>
                    <th className="px-3 py-2">Last trade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-slate-800/60">
                      <td className="px-3 py-2 text-slate-200">{user.email}</td>
                      <td className="px-3 py-2 text-slate-400">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={pendingRoles[user.id] ?? user.role}
                            onChange={(event) => handleRoleChange(user.id, event.target.value)}
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-primary focus:outline-none"
                          >
                            <option value="user">user</option>
                            <option value="premium">premium</option>
                            <option value="admin">admin</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => persistRole(user.id)}
                            disabled={savingId === user.id || (pendingRoles[user.id] ?? user.role) === user.role}
                            className="rounded bg-primary/80 px-2 py-1 text-xs font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-slate-700/60"
                          >
                            {savingId === user.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickRole(user.id, 'premium')}
                            disabled={savingId === user.id || user.role === 'premium'}
                            className="rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Upgrade to Premium
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickRole(user.id, 'user')}
                            disabled={savingId === user.id || user.role === 'user'}
                            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Revert
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">{user.plan}</td>
                      <td className="px-3 py-2">
                        <span
                          className={clsx(
                            'rounded-full px-2 py-1 text-xs font-semibold',
                            user.status.toLowerCase() === 'active'
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : user.status.toLowerCase() === 'trial'
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'bg-slate-700/40 text-slate-300'
                          )}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-200">${user.monthly_fee.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-200">{user.total_trades}</td>
                      <td className="px-3 py-2 text-slate-200">${user.volume.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400">
                        {new Date(user.next_renewal).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {user.last_trade_at ? new Date(user.last_trade_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminPage;
