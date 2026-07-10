import { useState, useEffect } from 'react'
import api from '../services/api'
import { Building2, Plus, Trash2, Edit3, X, Wallet, Mail, Phone, MapPin, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Organizations() {
  const { hasRole } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showCredits, setShowCredits] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState({ name: '', type: 'entreprise', email: '', phone: '', address: '', sms_balance: 0 })
  const [creditAmount, setCreditAmount] = useState(0)
  const [creditDesc, setCreditDesc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOrgs()
  }, [])

  const fetchOrgs = async () => {
    setLoading(true)
    try {
      const res = await api.get('/organizations')
      setOrgs(res.data.data || [res.data])
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/organizations', form)
      setShowForm(false)
      setForm({ name: '', type: 'entreprise', email: '', phone: '', address: '', sms_balance: 0 })
      fetchOrgs()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const toggleStatus = async (org) => {
    try {
      await api.patch(`/organizations/${org.id}/status`, { status: org.status === 'active' ? 'inactive' : 'active' })
      fetchOrgs()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette organisation ?')) return
    try {
      await api.delete(`/organizations/${id}`)
      fetchOrgs()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const openCredits = async (org) => {
    setShowCredits(org)
    setCreditAmount(0)
    setCreditDesc('')
    try {
      const res = await api.get(`/organizations/${org.id}/credits`)
      setTransactions(res.data.data || [])
    } catch (err) {
      setTransactions([])
    }
  }

  const addCredits = async () => {
    if (!creditAmount) return
    try {
      await api.post(`/organizations/${showCredits.id}/credits`, { amount: Number(creditAmount), description: creditDesc })
      const res = await api.get(`/organizations/${showCredits.id}/credits`)
      setTransactions(res.data.data || [])
      fetchOrgs()
      setCreditAmount(0)
      setCreditDesc('')
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const orgTypeColors = {
    banque: 'from-blue-500 to-indigo-600',
    ecole: 'from-emerald-500 to-teal-600',
    entreprise: 'from-purple-500 to-pink-600',
    ong: 'from-orange-500 to-red-500',
    administration: 'from-slate-600 to-gray-700',
  }

  if (!hasRole('super_admin')) {
    return (
      <div className="gem-card p-12 text-center">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Accès réservé au Super Administrateur</p>
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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{orgs.length} organisation{orgs.length > 1 ? 's' : ''}</h2>
          <p className="text-sm text-gray-500">Gérez les organisations et leurs crédits SMS</p>
        </div>
        <button onClick={() => setShowForm(true)} className="gem-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle organisation
        </button>
      </div>

      {loading ? (
        <div className="gem-card p-8 text-center text-gray-400">Chargement...</div>
      ) : orgs.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune organisation</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <div key={org.id} className="gem-card p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${orgTypeColors[org.type] || orgTypeColors.entreprise} flex items-center justify-center shadow-md`}>
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <span className={`gem-badge ${org.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  {org.status === 'active' ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <h3 className="font-bold text-gray-800 mb-1">{org.name}</h3>
              <p className="text-xs text-gray-400 capitalize mb-3">{org.type}</p>

              <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                {org.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> {org.email}</div>}
                {org.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {org.phone}</div>}
                {org.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {org.address}</div>}
              </div>

              <div className="bg-gradient-to-r from-brand-50 to-gem-purple/5 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Crédits SMS</span>
                  <span className="text-lg font-bold text-brand-600">{org.sms_balance?.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => openCredits(org)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
                  <Wallet className="w-3.5 h-3.5" />
                  Crédits
                </button>
                <button onClick={() => toggleStatus(org)} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  {org.status === 'active' ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => handleDelete(org.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Nouvelle organisation</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="gem-input w-full" required />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="gem-input w-full">
                <option value="entreprise">Entreprise</option>
                <option value="banque">Banque</option>
                <option value="ecole">École</option>
                <option value="ong">ONG</option>
                <option value="administration">Administration</option>
              </select>
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="gem-input w-full" />
              <input type="tel" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="gem-input w-full" />
              <input type="text" placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="gem-input w-full" />
              <input type="number" placeholder="Crédits SMS initiaux" value={form.sms_balance} onChange={(e) => setForm({ ...form, sms_balance: Number(e.target.value) })} className="gem-input w-full" />
              <button type="submit" className="gem-btn-primary w-full">Créer</button>
            </form>
          </div>
        </div>
      )}

      {/* Credits modal */}
      {showCredits && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCredits(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800">Crédits SMS — {showCredits.name}</h3>
                <p className="text-sm text-gray-500">Solde actuel: <span className="font-bold text-brand-600">{showCredits.sms_balance?.toLocaleString()}</span></p>
              </div>
              <button onClick={() => setShowCredits(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <input type="number" placeholder="Montant" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="gem-input flex-1" />
              <input type="text" placeholder="Description" value={creditDesc} onChange={(e) => setCreditDesc(e.target.value)} className="gem-input flex-1" />
              <button onClick={addCredits} className="gem-btn-primary px-4">OK</button>
            </div>

            <div className="space-y-2">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucune transaction</p>
              ) : transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {tx.amount > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{tx.description || 'Ajustement manuel'}</p>
                      <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
