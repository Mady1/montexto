import { useState, useEffect } from 'react'
import api from '../services/api'
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight, Activity, LogIn, LogOut, Edit3, Trash2, Plus, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const actionIcons = {
  'auth.login': LogIn,
  'auth.login_otp': LogIn,
  'auth.logout': LogOut,
  'auth.register': Plus,
  'auth.password_reset': Edit3,
  'user.create': Plus,
  'user.update': Edit3,
  'user.delete': Trash2,
  'organization.create': Plus,
  'organization.update': Edit3,
  'organization.delete': Trash2,
  'campaign.create': Mail,
}

const actionColors = {
  'auth.login': 'text-emerald-600 bg-emerald-50',
  'auth.login_otp': 'text-emerald-600 bg-emerald-50',
  'auth.logout': 'text-gray-500 bg-gray-100',
  'auth.register': 'text-blue-600 bg-blue-50',
  'user.create': 'text-brand-600 bg-brand-50',
  'user.update': 'text-amber-600 bg-amber-50',
  'user.delete': 'text-red-500 bg-red-50',
  'organization.create': 'text-brand-600 bg-brand-50',
  'organization.update': 'text-amber-600 bg-amber-50',
  'organization.delete': 'text-red-500 bg-red-50',
  'campaign.create': 'text-gem-purple bg-gem-purple/10',
}

export default function Audit() {
  const { hasRole } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ action: '', start_date: '', end_date: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 25, ...filters }
      Object.keys(params).forEach((k) => !params[k] && delete params[k])
      const res = await api.get('/audit', { params })
      setLogs(res.data.data || [])
      setTotalPages(res.data.pagination?.totalPages || 1)
      setTotal(res.data.pagination?.total || 0)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (e) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  if (!hasRole('super_admin', 'auditor')) {
    return (
      <div className="gem-card p-12 text-center">
        <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Accès restreint</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleFilter} className="gem-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-400 mb-1 block">Action</label>
          <input
            type="text"
            placeholder="ex: user.create"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="gem-input w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Du</label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="gem-input"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Au</label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="gem-input"
          />
        </div>
        <button type="submit" className="gem-btn-primary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filtrer
        </button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500">{total} entrée{total > 1 ? 's' : ''}</h2>
      </div>

      {/* Logs table */}
      {loading ? (
        <div className="gem-card p-8 text-center text-gray-400">Chargement...</div>
      ) : logs.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune entrée d'audit</p>
        </div>
      ) : (
        <div className="gem-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Organisation</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Détails</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">IP</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const Icon = actionIcons[log.action] || Activity
                const color = actionColors[log.action] || 'text-gray-500 bg-gray-100'
                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {log.first_name || log.last_name ? `${log.first_name} ${log.last_name}`.trim() : log.user_email || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{log.organization_name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 max-w-xs truncate">{log.details || '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">{log.ip_address || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
