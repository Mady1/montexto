import { useEffect, useState } from 'react'
import { Plus, Server, Trash2, Star, Loader2, X, Check, Radio, Zap, CheckCircle2, XCircle, Eye, EyeOff, Mail as MailIcon } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const providerGradients = {
  twilio: 'from-red-500 to-rose-600',
  vonage: 'from-purple-500 to-violet-600',
  messagebird: 'from-blue-500 to-indigo-600',
  orange: 'from-orange-500 to-amber-600',
  mt: 'from-emerald-500 to-teal-600',
  smtp: 'from-brand-500 to-brand-700',
  custom: 'from-gray-500 to-gray-700',
}

// SMTP is the only mail-channel provider; everything else is SMS.
const channelForProvider = (provider) => (provider === 'smtp' ? 'mail' : 'sms')

export default function Gateways() {
  const { hasRole, user } = useAuth()
  const isSuperAdmin = hasRole('super_admin')
  const [gateways, setGateways] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', provider: 'twilio', config: {}, isDefault: false, status: 'active', channel: 'sms', organizationId: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const STRUCTURED_PROVIDERS = ['orange', 'twilio', 'smtp']

  const updateConfig = (key, value) => {
    setForm((prev) => ({ ...prev, config: { ...prev.config, [key]: value } }))
  }

  const changeProvider = (provider) => {
    setForm((prev) => ({ ...prev, provider, channel: channelForProvider(provider), config: {} }))
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post('/gateways/test', {
        provider: form.provider,
        config: form.config,
        testPhone: form.provider !== 'smtp' ? (testPhone.trim() || undefined) : undefined,
        testEmail: form.provider === 'smtp' ? (testEmail.trim() || undefined) : undefined,
      })
      setTestResult(res.data)
    } catch (err) {
      setTestResult({ auth: { success: false, message: err.response?.data?.error || 'Erreur de test' } })
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    fetchGateways()
    if (isSuperAdmin) fetchOrganizations()
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

  const fetchOrganizations = async () => {
    try {
      const res = await api.get('/organizations')
      setOrganizations(res.data.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', provider: 'twilio', config: {}, isDefault: false, status: 'active', channel: 'sms', organizationId: isSuperAdmin ? null : user?.organizationId })
    setError('')
    setTestPhone('')
    setTestEmail('')
    setTestResult(null)
    setShowModal(true)
  }

  const parseGatewayConfig = (raw) => {
    if (!raw) return {}
    if (typeof raw !== 'string') return raw
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  const openEdit = (g) => {
    setEditing(g)
    setForm({
      name: g.name,
      provider: g.provider,
      config: parseGatewayConfig(g.config),
      isDefault: !!g.is_default,
      status: g.status,
      channel: g.channel || channelForProvider(g.provider),
      organizationId: g.organization_id,
    })
    setError('')
    setTestPhone('')
    setTestEmail('')
    setTestResult(null)
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
        await api.post('/gateways', { ...form, organizationId: form.organizationId })
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

  if (!hasRole('super_admin', 'org_admin')) {
    return (
      <div className="gem-card p-12 text-center">
        <p className="text-gray-500">Accès réservé aux administrateurs</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Passerelles</h2>
          <p className="text-sm text-gray-500 mt-1">Configurez les fournisseurs d'envoi SMS et email</p>
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
                  {(g.channel || channelForProvider(g.provider)) === 'mail' ? <MailIcon className="w-5 h-5 text-white" /> : <Server className="w-5 h-5 text-white" />}
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
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">{g.provider}</span>
                {g.organization_name && (
                  <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{g.organization_name}</span>
                )}
                {!g.organization_id && (
                  <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded">Global</span>
                )}
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
            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Organisation</label>
                <select
                  value={form.organizationId || ''}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value || null })}
                  className="gem-input w-full"
                >
                  <option value="">Global (toutes organisations)</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Le senderName de cette organisation sera utilisé pour ses envois</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fournisseur</label>
              <select
                value={form.provider}
                onChange={(e) => changeProvider(e.target.value)}
                className="gem-input w-full"
              >
                <optgroup label="SMS">
                  <option value="twilio">Twilio</option>
                  <option value="vonage">Vonage</option>
                  <option value="messagebird">MessageBird</option>
                  <option value="orange">Orange SMS</option>
                  <option value="mt">MT Mobile</option>
                  <option value="custom">Personnalisé (SMS)</option>
                </optgroup>
                <optgroup label="Email">
                  <option value="smtp">SMTP</option>
                </optgroup>
              </select>
            </div>
            {form.provider === 'orange' ? (
              <div className="space-y-3 p-3 rounded-xl bg-gray-50">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Client ID</label>
                  <input
                    type="text"
                    value={form.config.clientId || ''}
                    onChange={(e) => updateConfig('clientId', e.target.value)}
                    className="gem-input w-full font-mono text-xs"
                    placeholder="Fourni par Orange Developer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Client Secret</label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={form.config.clientSecret || ''}
                      onChange={(e) => updateConfig('clientSecret', e.target.value)}
                      className="gem-input w-full font-mono text-xs pr-10"
                      placeholder="Fourni par Orange Developer"
                    />
                    <button type="button" onClick={() => setShowSecret((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Numéro expéditeur (senderAddress)</label>
                  <input
                    type="text"
                    value={form.config.senderAddress || ''}
                    onChange={(e) => updateConfig('senderAddress', e.target.value)}
                    className="gem-input w-full font-mono text-xs"
                    placeholder="+22376000000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom expéditeur <span className="text-gray-400">(senderName)</span></label>
                  <input
                    type="text"
                    value={form.config.senderName || ''}
                    onChange={(e) => updateConfig('senderName', e.target.value)}
                    className="gem-input w-full"
                    placeholder="ex: LIBRE, MONTXTO"
                  />
                  <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">
                    ⚠ Ce nom doit être whitelisté par Orange Mali. Contactez votre chargé de compte Orange pour l'autoriser avant de l'utiliser.
                  </p>
                </div>
              </div>
            ) : form.provider === 'twilio' ? (
              <div className="space-y-3 p-3 rounded-xl bg-gray-50">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Account SID</label>
                  <input
                    type="text"
                    value={form.config.accountSid || ''}
                    onChange={(e) => updateConfig('accountSid', e.target.value)}
                    className="gem-input w-full font-mono text-xs"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Auth Token</label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={form.config.authToken || ''}
                      onChange={(e) => updateConfig('authToken', e.target.value)}
                      className="gem-input w-full font-mono text-xs pr-10"
                    />
                    <button type="button" onClick={() => setShowSecret((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Numéro Twilio (from)</label>
                  <input
                    type="text"
                    value={form.config.from || ''}
                    onChange={(e) => updateConfig('from', e.target.value)}
                    className="gem-input w-full font-mono text-xs"
                    placeholder="+15551234567"
                  />
                </div>
              </div>
            ) : form.provider === 'smtp' ? (
              <div className="space-y-3 p-3 rounded-xl bg-gray-50">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Hôte SMTP</label>
                    <input
                      type="text"
                      value={form.config.host || ''}
                      onChange={(e) => updateConfig('host', e.target.value)}
                      className="gem-input w-full font-mono text-xs"
                      placeholder="smtp.exemple.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Port</label>
                    <input
                      type="text"
                      value={form.config.port || ''}
                      onChange={(e) => updateConfig('port', e.target.value)}
                      className="gem-input w-full font-mono text-xs"
                      placeholder="587"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Utilisateur</label>
                  <input
                    type="text"
                    value={form.config.user || ''}
                    onChange={(e) => updateConfig('user', e.target.value)}
                    className="gem-input w-full font-mono text-xs"
                    placeholder="contact@votredomaine.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={form.config.pass || ''}
                      onChange={(e) => updateConfig('pass', e.target.value)}
                      className="gem-input w-full font-mono text-xs pr-10"
                    />
                    <button type="button" onClick={() => setShowSecret((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Adresse expéditeur <span className="text-gray-400">(optionnel, sinon "Utilisateur")</span></label>
                  <input
                    type="text"
                    value={form.config.from || ''}
                    onChange={(e) => updateConfig('from', e.target.value)}
                    className="gem-input w-full font-mono text-xs"
                    placeholder="Montexto <contact@votredomaine.com>"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Configuration (JSON)</label>
                <textarea
                  value={JSON.stringify(form.config, null, 2)}
                  onChange={(e) => {
                    try { setForm({ ...form, config: JSON.parse(e.target.value) }) } catch {}
                  }}
                  className="gem-input w-full font-mono text-xs"
                  rows={5}
                  placeholder='{"apiKey": "...", "sender": "..."}'
                />
              </div>
            )}

            {STRUCTURED_PROVIDERS.includes(form.provider) && (
              <div className="p-3 rounded-xl border border-dashed border-gray-200 space-y-2">
                <label className="block text-xs font-medium text-gray-500">Tester la connexion</label>
                <div className="flex gap-2">
                  {form.provider === 'smtp' ? (
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="gem-input flex-1 text-xs"
                      placeholder="Email de test (optionnel) — sinon vérifie juste la connexion SMTP"
                    />
                  ) : (
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="gem-input flex-1 text-xs"
                      placeholder="Numéro de test (optionnel) — sinon vérifie juste l'authentification"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="gem-btn-secondary flex items-center gap-1.5 text-xs px-3 whitespace-nowrap disabled:opacity-60"
                  >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Tester
                  </button>
                </div>
                {testResult && (
                  <div className="space-y-1.5 pt-1">
                    <div className={`flex items-start gap-2 text-xs ${testResult.auth?.success ? 'text-emerald-600' : 'text-red-600'}`}>
                      {testResult.auth?.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                      <span>{testResult.auth?.message}</span>
                    </div>
                    {testResult.send?.attempted && (
                      <div className={`flex items-start gap-2 text-xs ${testResult.send.success ? 'text-emerald-600' : 'text-red-600'}`}>
                        {testResult.send.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                        <span>{testResult.send.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
