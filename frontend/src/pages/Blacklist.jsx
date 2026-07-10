import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { Ban, Plus, Trash2, Search, X, Upload, Phone, ShieldBan } from 'lucide-react'

export default function Blacklist() {
  const { hasPermission } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ total: 0, opt_outs: 0, manual: 0, from_inbound: 0 })
  const [showAdd, setShowAdd] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newReason, setNewReason] = useState('manual')

  const canEdit = hasPermission('contacts.edit')

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const res = await api.get('/blacklist', { params: { page, limit: 50, search } })
      setEntries(res.data.data || [])
      setTotalPages(res.data.totalPages || 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/blacklist/stats')
      setStats(res.data.data || { total: 0, opt_outs: 0, manual: 0, from_inbound: 0 })
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { fetchEntries(); fetchStats() }, [page])
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchEntries() }, 300); return () => clearTimeout(t) }, [search])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newPhone.trim()) return
    try {
      await api.post('/blacklist', { phone: newPhone.trim(), reason: newReason })
      setNewPhone('')
      setShowAdd(false)
      fetchEntries()
      fetchStats()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Retirer ce numéro de la liste noire ?')) return
    try {
      await api.delete(`/blacklist/${id}`)
      fetchEntries()
      fetchStats()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const reasonLabels = {
    manual: 'Manuel',
    opt_out_sms: 'Désinscription SMS',
    complaint: 'Plainte',
    invalid: 'Numéro invalide',
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="gem-card p-4">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
        <div className="gem-card p-4">
          <div className="text-2xl font-bold text-red-600">{stats.opt_outs}</div>
          <div className="text-xs text-gray-400">Désinscriptions</div>
        </div>
        <div className="gem-card p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.manual}</div>
          <div className="text-xs text-gray-400">Manuels</div>
        </div>
        <div className="gem-card p-4">
          <div className="text-2xl font-bold text-brand-600">{stats.from_inbound}</div>
          <div className="text-xs text-gray-400">Via SMS reçu</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro..."
            className="gem-input w-full pl-10 py-2"
          />
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="gem-btn-primary flex items-center justify-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {/* List */}
      <div className="gem-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldBan className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Aucun numéro en liste noire</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Numéro</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Raison</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ajouté par</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  {canEdit && <th className="px-5 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-800">{entry.phone}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`gem-badge ${entry.reason === 'opt_out_sms' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {reasonLabels[entry.reason] || entry.reason}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {entry.source === 'inbound' ? 'SMS reçu' : 'Manuel'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {entry.first_name ? `${entry.first_name} ${entry.last_name}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3">
                        <button onClick={() => handleDelete(entry.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter à la liste noire">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Numéro de téléphone</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className="gem-input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Raison</label>
            <select value={newReason} onChange={(e) => setNewReason(e.target.value)} className="gem-input w-full">
              <option value="manual">Manuel</option>
              <option value="complaint">Plainte</option>
              <option value="invalid">Numéro invalide</option>
            </select>
          </div>
          <button type="submit" className="gem-btn-primary w-full">Ajouter</button>
        </form>
      </Modal>
    </div>
  )
}
