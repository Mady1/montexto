import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Copy, Check, Eye, EyeOff, ShieldCheck, KeyRound, Code2, Terminal } from 'lucide-react'
import api from '../services/api'

const API_BASE = `${window.location.origin}/api/v1`

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/sms/send',
    desc: 'Envoyer un SMS à un numéro',
    body: '{"to": "+22376123456", "message": "Bonjour !"}',
  },
  {
    method: 'POST',
    path: '/sms/send-bulk',
    desc: 'Envoyer un SMS à plusieurs numéros',
    body: '{"phones": ["+22376000001", "+22376000002"], "message": "Bonjour !"}',
  },
  {
    method: 'GET',
    path: '/balance',
    desc: 'Consulter le solde de crédits SMS',
    body: null,
  },
]

function curlFor(endpoint, sampleKey) {
  const url = `${API_BASE}${endpoint.path}`
  if (endpoint.method === 'GET') {
    return `curl "${url}" \\\n  -H "X-API-Key: ${sampleKey}"`
  }
  return `curl -X POST "${url}" \\\n  -H "X-API-Key: ${sampleKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.body}'`
}

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [visibleKeys, setVisibleKeys] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const res = await api.get('/api-keys')
      setKeys(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api-keys', { name })
      setName('')
      fetchKeys()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette clé API ? Cette action est irréversible.')) return
    setError('')
    try {
      await api.delete(`/api-keys/${id}`)
      fetchKeys()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression de la clé')
    }
  }

  const copyToClipboard = (value, id) => {
    navigator.clipboard.writeText(value)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleVisible = (id) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const maskKey = (key) => key.slice(0, 8) + '••••••••••••••••••••' + key.slice(-4)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Clés API développeur</h2>
        <p className="text-sm text-gray-500 mt-1">Générez des clés API pour intégrer Montexto à vos applications</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
          {error}
        </div>
      )}

      <div className="bg-brand-50/60 border border-brand-100 rounded-2xl p-4 mb-6 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-700">
          <p className="font-medium mb-1">Sécurité de vos clés API</p>
          <p className="text-brand-600">Ne partagez jamais vos clés API publiquement. Elles donnent accès à votre compte et à vos données. Traitez-les comme des mots de passe.</p>
        </div>
      </div>

      <div className="gem-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-4 h-4 text-brand-500" />
          <h3 className="text-base font-semibold text-gray-800">Utiliser l'API</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Authentifiez chaque requête avec l'en-tête <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">X-API-Key</code>. Base URL : <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">{API_BASE}</code>
        </p>
        <div className="space-y-3">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="rounded-xl bg-gray-50 overflow-hidden">
              <div className="px-4 py-2 flex items-center gap-2 text-xs">
                <span className={`font-mono font-semibold px-1.5 py-0.5 rounded ${ep.method === 'GET' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{ep.method}</span>
                <span className="font-mono text-gray-600">{ep.path}</span>
                <span className="text-gray-400">— {ep.desc}</span>
              </div>
              <pre className="px-4 pb-3 text-xs font-mono text-gray-500 overflow-x-auto whitespace-pre">{curlFor(ep, keys[0]?.key_value || 'VOTRE_CLE_API')}</pre>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="gem-card p-6 mb-6">
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom de la clé</label>
            <input
              placeholder="Ex: Application production"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="gem-input w-full"
              required
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="gem-btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" /> Générer
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : keys.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune clé API</h3>
          <p className="text-sm text-gray-500">Générez votre première clé API ci-dessus</p>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((k) => (
            <div key={k.id} className="gem-card p-5 group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-gem-purple rounded-xl flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{k.name}</h3>
                    <span className="text-xs text-gray-400">
                      Créée le {new Date(k.created_at).toLocaleString('fr-FR')}
                      {k.last_used_at ? ` · Dernière utilisation ${new Date(k.last_used_at).toLocaleString('fr-FR')}` : ' · Jamais utilisée'}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(k.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-4 py-2.5">
                <code className="flex-1 text-xs text-gray-600 font-mono break-all">
                  {visibleKeys[k.id] ? k.key_value : maskKey(k.key_value)}
                </code>
                <button onClick={() => toggleVisible(k.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  {visibleKeys[k.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copyToClipboard(k.key_value, k.id)} className="text-gray-400 hover:text-brand-600 flex-shrink-0">
                  {copied === k.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
