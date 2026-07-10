import { useEffect, useState } from 'react'
import { Plus, Server, Trash2, Star, Loader2, X, Check, Radio } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const providerGradients = {
  twilio: 'from-red-500 to-rose-600',
  vonage: 'from-purple-500 to-violet-600',
  messagebird: 'from-blue-500 to-indigo-600',
  orange: 'from-orange-500 to-amber-600',
  mt: 'from-emerald-500 to-teal-600',
  custom: 'from-gray-500 to-gray-700',
}

export default function Gateways() {
  const { hasRole } = useAuth()
  const [gateways, setGateways] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', provider: 'twilio', config: {}, isDefault: false, status: 'active' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchGateways()
  }, [])

  const fetchGateways = async () => {
    try {
      const res = await api.get('/gateways')
      setGateways(res.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', provider: 'twilio', config: {}, isDefault: false, status: 'active' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (g) => {
    setEditing(g)
    setForm({
      name: g.name,
      provider: g.provider,
      config: g.config ? (typeof g.config === 'string' ? JSON.parse(g.config) : g.config) : {},
      isDefault: !!g.is_default,
      status: g.status,
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.put(`/gateways/${editing.id}`, form)
      } else {
        await api.post('/gateways', form)
      }
      setShowModal(false)
      fetchGateways()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette passerelle ?')) return
    try {
      await api.delete(`/gateways/${id}`)
      fetchGateways()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/gateways/${id}/default`)
      fetchGateways()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  if (!hasRole('super_admin')) {
    return (
      <div className="gem-card p-12 text-center">
        <p className="text-gray-500">Accès réservé aux super administrateurs</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Passerelles SMS</h2>
          <p className="text-sm text-gray-500 mt-1">Configurez les fournisseurs d'envoi SMS</p>
        </div>
        <button onClick={openCreate} className="gem-btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : gateways.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Server className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune passerelle</h3>
          <p className="text-sm text-gray-500 mb-4">Ajoutez votre premier fournisseur SMS</p>
          <button onClick={openCreate} className="gem-btn-primary inline-flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gateways.map((g) => (
            <div key={g.id} className="gem-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${providerGradients[g.provider] || providerGradients.custom} flex items-center justify-center shadow-sm`}>
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-1">
                  {g.is_default ? (
                    <span className="gem-badge bg-amber-50 text-amber-600 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-500" /> Défaut
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(g.id)}
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Définir par défaut"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{g.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">{g.provider}</span>
                <span className={`gem-badge ${g.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  <span className={`w-1.5 h-1.5 ${g.status === 'active' ? 'bg-green-500' : 'bg-red-500'} rounded-full`}></span>
                  {g.status === 'active' ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(g)} className="flex-1 text-xs font-medium text-gray-600 hover:text-brand-600 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Modifier
                </button>
                {!g.is_default && (
                  <button onClick={() => handleDelete(g.id)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`${editing ? 'Modifier' : 'Nouvelle'} passerelle`}>
        <div className="max-h-[70vh] overflow-y-auto">
          {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="gem-input w-full"
                placeholder="ex: Twilio Principal"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fournisseur</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="gem-input w-full"
              >
                <option value="twilio">Twilio</option>
                <option value="vonage">Vonage</option>
                <option value="messagebird">MessageBird</option>
                <option value="orange">Orange SMS</option>
                <option value="mt">MT Mobile</option>
                <option value="custom">Personnalisé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Configuration (JSON)</label>
              <textarea
                value={JSON.stringify(form.config, null, 2)}
                onChange={(e) => {
                  try { setForm({ ...form, config: JSON.parse(e.target.value) }) } catch {}
                }}
                className="gem-input w-full font-mono text-xs"
                rows={5}
                placeholder='{"accountSid": "...", "authToken": "...", "from": "+123..."}'
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="gem-input w-full"
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="w-4 h-4 rounded text-brand-600"
              />
              <span className="text-sm text-gray-600">Définir comme passerelle par défaut</span>
            </label>
            <button type="submit" disabled={saving} className="gem-btn-primary w-full flex items-center justify-center disabled:opacity-60">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{editing ? 'Modifier' : 'Créer'} <Check className="w-4 h-4 ml-2" /></>}
            </button>
          </form>
        </div>
      </Modal>
    </div>
  )
}
