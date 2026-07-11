import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { Inbox, Phone, MessageSquare, CheckCheck, Trash2, Search, X, MessagesSquare, List } from 'lucide-react'

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
  const [viewMode, setViewMode] = useState('list')
  const [selectedThread, setSelectedThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)

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

  const threads = Object.values(
    messages.reduce((acc, m) => {
      if (!acc[m.from_phone]) {
        acc[m.from_phone] = { from_phone: m.from_phone, first_name: m.first_name, last_name: m.last_name, latest: m, unread: 0 }
      }
      if (new Date(m.received_at) > new Date(acc[m.from_phone].latest.received_at)) {
        acc[m.from_phone].latest = m
      }
      if (!m.is_read) acc[m.from_phone].unread += 1
      return acc
    }, {})
  ).sort((a, b) => new Date(b.latest.received_at) - new Date(a.latest.received_at))

  const openThread = async (phone) => {
    setSelectedThread(phone)
    setThreadLoading(true)
    try {
      const res = await api.get('/inbound/inbox', { params: { phone, limit: 200 } })
      const thread = (res.data.data || []).slice().reverse()
      setThreadMessages(thread)
      const unread = thread.filter((m) => !m.is_read)
      await Promise.all(unread.map((m) => api.patch(`/inbound/inbox/${m.id}/read`)))
      if (unread.length > 0) {
        setMessages((prev) => prev.map((m) => (m.from_phone === phone ? { ...m, is_read: 1 } : m)))
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setThreadLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="gem-card p-5">
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
        <div className="gem-card p-5">
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
        <div className="gem-card p-5">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${unreadOnly ? 'bg-brand-500 text-white' : 'bg-[var(--gem-surface)] text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Non lus uniquement
          </button>
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-[var(--gem-surface)] text-brand-600 shadow-sm' : 'text-gray-500'}`}
            >
              <List className="w-3.5 h-3.5" /> Liste
            </button>
            <button
              onClick={() => setViewMode('threads')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'threads' ? 'bg-[var(--gem-surface)] text-brand-600 shadow-sm' : 'text-gray-500'}`}
            >
              <MessagesSquare className="w-3.5 h-3.5" /> Conversations
            </button>
          </div>
        </div>
        <button onClick={handleMarkAllRead} className="gem-btn-secondary flex items-center justify-center gap-2 text-sm">
          <CheckCheck className="w-4 h-4" /> Tout marquer lu
        </button>
      </div>

      {viewMode === 'threads' ? (
        <div className="gem-card overflow-hidden grid grid-cols-1 md:grid-cols-3" style={{ minHeight: '480px' }}>
          <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-gray-100 divide-y divide-gray-50 overflow-y-auto max-h-[480px]">
            {threads.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Aucune conversation</div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.from_phone}
                  onClick={() => openThread(t.from_phone)}
                  className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedThread === t.from_phone ? 'bg-brand-50/50' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.unread > 0 ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800 text-sm truncate">
                        {t.first_name ? `${t.first_name} ${t.last_name}` : t.from_phone}
                      </span>
                      {t.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-gem-pink text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {t.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{t.latest.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="md:col-span-2 flex flex-col max-h-[480px]">
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-8 text-center">
                Sélectionnez une conversation pour voir l'historique complet
              </div>
            ) : threadLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadMessages.map((m) => (
                  <div key={m.id} className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-gray-700">{m.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(m.received_at).toLocaleString('fr-FR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="gem-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
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
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={!!selectedMsg} onClose={() => setSelectedMsg(null)} title="SMS reçu">
        {selectedMsg && (
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
        )}
      </Modal>
    </div>
  )
}
