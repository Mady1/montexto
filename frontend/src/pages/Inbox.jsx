import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Inbox, Phone, MessageSquare, CheckCheck, Trash2, Search, X } from 'lucide-react'

export default function InboxPage() {
  const { hasPermission } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, unread: 0, unique_senders: 0 })
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedMsg, setSelectedMsg] = useState(null)

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const res = await api.get('/inbound/inbox', { params: { page, limit: 50, unreadOnly } })
      setMessages(res.data.data || [])
      setTotalPages(res.data.totalPages || 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/inbound/inbox/stats')
      setStats(res.data.data || { total: 0, unread: 0, unique_senders: 0 })
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchMessages()
    fetchStats()
  }, [page, unreadOnly])

  const handleMarkRead = async (id) => {
    await api.patch(`/inbound/inbox/${id}/read`)
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: 1 } : m)))
    setSelectedMsg(null)
    fetchStats()
  }

  const handleMarkAllRead = async () => {
    await api.patch('/inbound/inbox/read-all')
    setMessages((prev) => prev.map((m) => ({ ...m, is_read: 1 })))
    fetchStats()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce SMS ?')) return
    await api.delete(`/inbound/inbox/${id}`)
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setSelectedMsg(null)
    fetchStats()
  }

  const filtered = search
    ? messages.filter((m) => m.from_phone.includes(search) || m.message.toLowerCase().includes(search.toLowerCase()))
    : messages

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-xs text-gray-400">Total reçus</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{stats.unread}</div>
              <div className="text-xs text-gray-400">Non lus</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{stats.unique_senders}</div>
              <div className="text-xs text-gray-400">Expéditeurs uniques</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="gem-input w-full pl-10 py-2"
            />
          </div>
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${unreadOnly ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Non lus uniquement
          </button>
        </div>
        <button onClick={handleMarkAllRead} className="gem-btn-secondary flex items-center gap-2 text-sm">
          <CheckCheck className="w-4 h-4" /> Tout marquer lu
        </button>
      </div>

      {/* Messages list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Aucun SMS reçu</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  setSelectedMsg(msg)
                  if (!msg.is_read) handleMarkRead(msg.id)
                }}
                className={`flex items-start gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!msg.is_read ? 'bg-brand-50/30' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!msg.is_read ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 text-sm">{msg.from_phone}</span>
                    {!msg.is_read && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
                    {msg.first_name && <span className="text-xs text-gray-400">{msg.first_name} {msg.last_name}</span>}
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-0.5">{msg.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{new Date(msg.received_at).toLocaleString('fr-FR')}</span>
                    {msg.gateway_provider && <span className="text-xs text-gray-400">via {msg.gateway_provider}</span>}
                  </div>
                </div>
                {hasPermission('sms.delete') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Précédent</button>
          <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Suivant</button>
        </div>
      )}

      {/* Detail modal */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedMsg(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">SMS reçu</h3>
              <button onClick={() => setSelectedMsg(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Expéditeur</div>
                <div className="font-medium text-gray-800">{selectedMsg.from_phone}</div>
                {selectedMsg.first_name && <div className="text-sm text-gray-500">{selectedMsg.first_name} {selectedMsg.last_name}</div>}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Message</div>
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">{selectedMsg.message}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{new Date(selectedMsg.received_at).toLocaleString('fr-FR')}</span>
                {selectedMsg.gateway_provider && <span>via {selectedMsg.gateway_provider}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
