import { useEffect, useState } from 'react'
import { Send, Loader2, History, Search, CheckCircle, XCircle, Smartphone, Users } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

const statusConfig = {
  delivered: { label: 'Délivré', className: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  simulated: { label: 'Simulé', className: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  failed: { label: 'Échoué', className: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
}

export default function QuickSms() {
  const { hasPermission } = useAuth()
  const canBulk = hasPermission('sms.send_bulk')

  const [mode, setMode] = useState('single')
  const [to, setTo] = useState('')
  const [phones, setPhones] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const smsSegments = Math.ceil(message.length / 160) || 1
  const bulkCount = phones.split(/[\n,;]/).map((n) => n.trim()).filter(Boolean).length

  useEffect(() => {
    fetchHistory()
  }, [page, statusFilter])

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await api.get('/sms/history', {
        params: { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, status: statusFilter || undefined, search: search || undefined },
      })
      setHistory(res.data.data || [])
      setTotal(res.data.total || 0)
      setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / PAGE_SIZE)))
    } catch (err) {
      console.error(err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchHistory()
  }

  const handleSend = async (e) => {
    e.preventDefault()
    setSending(true)
    setSendResult(null)
    try {
      if (mode === 'single') {
        const res = await api.post('/sms/send', { to, message })
        setSendResult({ type: 'single', data: res.data })
        setTo('')
      } else {
        const phoneList = phones.split(/[\n,;]/).map((n) => n.trim()).filter(Boolean)
        const res = await api.post('/sms/send-bulk', { phones: phoneList, message })
        setSendResult({ type: 'bulk', data: res.data })
        setPhones('')
      }
      setMessage('')
      setPage(1)
      fetchHistory()
    } catch (err) {
      setSendResult({ type: 'error', message: err.response?.data?.error || "Erreur lors de l'envoi" })
    } finally {
      setSending(false)
    }
  }

  if (!hasPermission('sms.send')) {
    return (
      <div className="gem-card p-12 text-center">
        <p className="text-gray-500">Vous n'avez pas la permission d'envoyer des SMS</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Envoi rapide</h2>
        <p className="text-sm text-gray-500 mt-1">Envoyez un SMS ponctuel, hors campagne, et consultez l'historique</p>
      </div>

      <form onSubmit={handleSend} className="gem-card p-6 mb-6">
        {canBulk && (
          <div className="flex space-x-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'single' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Smartphone className="w-4 h-4 mr-2" /> Un numéro
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all ${mode === 'bulk' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Users className="w-4 h-4 mr-2" /> Plusieurs numéros
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {mode === 'single' ? 'Numéro' : `Numéros (${bulkCount})`}
            </label>
            {mode === 'single' ? (
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="gem-input w-full"
                placeholder="+22376123456"
                required
              />
            ) : (
              <textarea
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                rows={3}
                className="gem-input w-full resize-none"
                placeholder="+22376123456, +22376000000&#10;Séparés par virgule, point-virgule ou retour à la ligne"
                required
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={mode === 'single' ? 3 : 3}
              maxLength={1600}
              className="gem-input w-full resize-none"
              placeholder="Tapez votre message ici..."
              required
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{message.length} / 1600</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${smsSegments > 1 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                {smsSegments} segment{smsSegments > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={sending} className="gem-btn-primary flex items-center justify-center disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Envoyer
          </button>

          {sendResult && (
            <div className="text-sm">
              {sendResult.type === 'error' ? (
                <span className="text-red-600 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> {sendResult.message}</span>
              ) : sendResult.type === 'single' ? (
                <span className={`flex items-center gap-1.5 ${sendResult.data.error ? 'text-red-600' : 'text-emerald-600'}`}>
                  {sendResult.data.error ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {sendResult.data.error || `Envoyé (statut : ${sendResult.data.status})`}
                </span>
              ) : (
                <span className="text-gray-600">
                  {sendResult.data.delivered} délivré(s), {sendResult.data.failed} échoué(s)
                  {sendResult.data.skipped > 0 ? `, ${sendResult.data.skipped} ignoré(s) (liste noire)` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </form>

      {hasPermission('sms.history') && (
        <div className="gem-card overflow-hidden">
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-800">Historique</h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{total}</span>
            </div>
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un numéro..."
                  className="gem-input pl-9 text-sm py-2"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="gem-input text-sm py-2"
              >
                <option value="">Tous statuts</option>
                <option value="delivered">Délivré</option>
                <option value="failed">Échoué</option>
                <option value="simulated">Simulé</option>
              </select>
            </form>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucun SMS envoyé pour le moment</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Numéro</th>
                    <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Destinataire</th>
                    <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Erreur</th>
                    <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const status = statusConfig[h.status] || statusConfig.pending
                    return (
                      <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{h.phone}</td>
                        <td className="px-6 py-3 text-gray-600">{h.first_name ? `${h.first_name} ${h.last_name || ''}` : '-'}</td>
                        <td className="px-6 py-3">
                          <span className={`gem-badge ${status.className}`}>
                            <span className={`w-1.5 h-1.5 ${status.dot} rounded-full`}></span>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-400 text-xs max-w-[220px] truncate" title={h.error_message || ''}>{h.error_message || '-'}</td>
                        <td className="px-6 py-3 text-gray-500 font-mono text-xs">{h.sent_at ? new Date(h.sent_at).toLocaleString('fr-FR') : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-gray-100">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
