import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Eye, Loader2, Mail, Inbox, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import api from '../services/api'

const statusConfig = {
  sent: { label: 'Envoyé', className: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  scheduled: { label: 'Programmé', className: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  validated: { label: 'Validé', className: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  cancelled: { label: 'Annulé', className: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns')
      setCampaigns(res.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async (id) => {
    setActionLoading(`v-${id}`)
    try {
      await api.patch(`/campaigns/${id}/validate`)
      fetchCampaigns()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (id) => {
    if (!confirm('Annuler cette campagne ?')) return
    setActionLoading(`c-${id}`)
    try {
      await api.patch(`/campaigns/${id}/cancel`)
      fetchCampaigns()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette campagne ?')) return
    setActionLoading(`d-${id}`)
    try {
      await api.delete(`/campaigns/${id}`)
      fetchCampaigns()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Campagnes</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez et suivez vos campagnes SMS</p>
        </div>
        <Link to="/campaigns/new" className="gem-btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Nouvelle campagne
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune campagne</h3>
          <p className="text-sm text-gray-500 mb-4">Commencez par créer votre première campagne SMS</p>
          <Link to="/campaigns/new" className="gem-btn-primary inline-flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Créer une campagne
          </Link>
        </div>
      ) : (
        <div className="gem-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Nom</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Destinataires</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Délivrés</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Échoués</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const status = statusConfig[c.status] || statusConfig.draft
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-gem-purple rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-gray-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded uppercase">{c.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`gem-badge ${status.className}`}>
                        <span className={`w-1.5 h-1.5 ${status.dot} rounded-full`}></span>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.total_recipients}</td>
                    <td className="px-6 py-4"><span className="text-green-600 font-medium">{c.delivered}</span></td>
                    <td className="px-6 py-4"><span className="text-red-600 font-medium">{c.failed}</span></td>
                    <td className="px-6 py-4 text-gray-500">{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Link to={`/campaigns/${c.id}`} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Voir">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {c.status === 'draft' && (
                          <button
                            onClick={() => handleValidate(c.id)}
                            disabled={actionLoading === `v-${c.id}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Valider"
                          >
                            {actionLoading === `v-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                        {c.status !== 'sent' && c.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancel(c.id)}
                            disabled={actionLoading === `c-${c.id}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Annuler"
                          >
                            {actionLoading === `c-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={actionLoading === `d-${c.id}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          {actionLoading === `d-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
