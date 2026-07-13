import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Send, CheckCircle, XCircle, Clock, MessageSquare, Search } from 'lucide-react'
import api from '../services/api'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

const statusConfig = {
  sent: { label: 'Envoyé', className: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  scheduled: { label: 'Programmé', className: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  sending: { label: 'Envoi en cours', className: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  validated: { label: 'Validé', className: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  cancelled: { label: 'Annulé', className: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
}

const recipientStatusConfig = {
  delivered: { label: 'Délivré', className: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  simulated: { label: 'Simulé', className: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  failed: { label: 'Échoué', className: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  queued: { label: 'En file', className: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  retry: { label: 'Nouvelle tentative', className: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  pending: { label: 'En attente', className: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
}

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchCampaign()
  }, [id])

  const fetchCampaign = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/campaigns/${id}`)
      setCampaign(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Campagne introuvable')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="gem-card p-12 text-center">
        <p className="text-gray-500 mb-4">{error || 'Campagne introuvable'}</p>
        <button onClick={() => navigate('/campaigns')} className="gem-btn-secondary inline-flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux campagnes
        </button>
      </div>
    )
  }

  const status = statusConfig[campaign.status] || statusConfig.draft
  const recipients = campaign.recipients || []

  const filtered = recipients.filter((r) => {
    const matchesSearch = !search || `${r.phone} ${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || r.status === statusFilter
    return matchesSearch && matchesStatus
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/campaigns')} className="mr-4 w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-800 truncate">{campaign.name}</h2>
            <span className={`gem-badge ${status.className}`}>
              <span className={`w-1.5 h-1.5 ${status.dot} rounded-full`}></span>
              {status.label}
            </span>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded uppercase">{campaign.type}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Créée le {new Date(campaign.created_at).toLocaleString('fr-FR')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="gem-card p-5">
          <span className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Send className="w-3.5 h-3.5" /> Destinataires</span>
          <div className="font-serif text-2xl font-semibold text-gray-800 tabular-nums">{campaign.total_recipients}</div>
        </div>
        <div className="gem-card p-5">
          <span className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Délivrés</span>
          <div className="font-serif text-2xl font-semibold text-green-600 tabular-nums">{campaign.delivered}</div>
        </div>
        <div className="gem-card p-5">
          <span className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><XCircle className="w-3.5 h-3.5 text-red-400" /> Échoués</span>
          <div className="font-serif text-2xl font-semibold text-red-600 tabular-nums">{campaign.failed}</div>
        </div>
        <div className="gem-card p-5">
          <span className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5 text-orange-400" /> En attente</span>
          <div className="font-serif text-2xl font-semibold text-orange-600 tabular-nums">{campaign.pending}</div>
        </div>
        <div className="gem-card p-5">
          <span className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">Coût</span>
          <div className="font-serif text-2xl font-semibold text-gray-800 tabular-nums">{Number(campaign.cost || 0).toLocaleString('fr-FR')} <span className="text-sm font-sans font-medium text-gray-400">FCFA</span></div>
        </div>
      </div>

      <div className="gem-card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-brand-500" /> Message</h3>
        <div className="bg-gray-900 rounded-2xl p-4 inline-block max-w-full">
          <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-md whitespace-pre-wrap break-words">
            {campaign.message}
          </div>
        </div>
        {campaign.scheduled_at && (
          <p className="text-xs text-gray-400 mt-3">Programmée pour le {new Date(campaign.scheduled_at).toLocaleString('fr-FR')}</p>
        )}
      </div>

      <div className="gem-card overflow-hidden">
        <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-800">Destinataires ({filtered.length})</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Rechercher un destinataire..."
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
              <option value="queued">En file</option>
              <option value="pending">En attente</option>
              <option value="simulated">Simulé</option>
            </select>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucun destinataire ne correspond</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Numéro</th>
                  <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Erreur</th>
                  <th className="px-6 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Envoyé le</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => {
                  const rStatus = recipientStatusConfig[r.status] || recipientStatusConfig.pending
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3 font-mono text-xs text-gray-700">{r.phone}</td>
                      <td className="px-6 py-3 text-gray-600">{r.first_name ? `${r.first_name} ${r.last_name || ''}` : '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`gem-badge ${rStatus.className}`}>
                          <span className={`w-1.5 h-1.5 ${rStatus.dot} rounded-full`}></span>
                          {rStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-400 text-xs max-w-[220px] truncate" title={r.error_message || ''}>{r.error_message || '-'}</td>
                      <td className="px-6 py-3 text-gray-500 font-mono text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString('fr-FR') : '-'}</td>
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
    </div>
  )
}
