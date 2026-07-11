import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, Users, Smartphone, MessageSquare, Info, ArrowLeft, Calendar, ShieldAlert, Copy } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function NewCampaign() {
  const { hasPermission } = useAuth()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('group')
  const [groupId, setGroupId] = useState('')
  const [manualNumbers, setManualNumbers] = useState('')
  const [groups, setGroups] = useState([])
  const [sending, setSending] = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [existingCampaigns, setExistingCampaigns] = useState([])
  const [duplicateId, setDuplicateId] = useState('')
  const [duplicating, setDuplicating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchGroups()
    fetchExistingCampaigns()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups')
      setGroups(res.data || [])
      if (res.data.length > 0) setGroupId(res.data[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchExistingCampaigns = async () => {
    try {
      const res = await api.get('/campaigns')
      setExistingCampaigns(res.data.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleDuplicate = async (id) => {
    setDuplicateId(id)
    if (!id) return
    setDuplicating(true)
    try {
      const res = await api.get(`/campaigns/${id}`)
      const source = res.data
      setName(`Copie de ${source.name}`)
      setMessage(source.message || '')
      setMode('manual')
      const phones = [...new Set((source.recipients || []).map((r) => r.phone).filter(Boolean))]
      setManualNumbers(phones.join('\n'))
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la duplication')
    } finally {
      setDuplicating(false)
    }
  }

  const smsSegments = Math.ceil(message.length / 160) || 1
  const recipientCount = mode === 'manual'
    ? manualNumbers.split(/[\n,;]/).map((n) => n.trim()).filter(Boolean).length
    : groups.find((g) => g.id === Number(groupId))?.contact_count || 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      const payload = { name, message, type: 'sms' }
      if (mode === 'group') {
        payload.groupId = Number(groupId)
      } else {
        payload.recipients = manualNumbers.split(/[\n,;]/).map((n) => n.trim()).filter(Boolean)
      }
      if (scheduleEnabled && scheduleAt) {
        payload.scheduleAt = scheduleAt
      }
      await api.post('/campaigns', payload)
      navigate('/campaigns')
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  if (!hasPermission('campaigns.create')) {
    return (
      <div className="gem-card p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Vous n'avez pas la permission de créer une campagne</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/campaigns')} className="mr-4 w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Nouvelle campagne</h2>
          <p className="text-sm text-gray-500 mt-1">Composez et envoyez votre campagne SMS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="gem-card p-6 lg:col-span-2">
          {existingCampaigns.length > 0 && (
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Dupliquer une campagne existante (optionnel)
              </label>
              <select
                value={duplicateId}
                onChange={(e) => handleDuplicate(e.target.value)}
                className="gem-input w-full"
                disabled={duplicating}
              >
                <option value="">Partir d'une campagne vierge</option>
                {existingCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom de la campagne</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="gem-input w-full"
              placeholder="Ex: Promotion été 2026"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="gem-input w-full resize-none"
              required
              maxLength={1600}
              placeholder="Tapez votre message ici..."
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{message.length} / 1600 caractères</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${smsSegments > 1 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                {smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Variables disponibles : <code className="font-mono">{'{{firstName}}'}</code>, <code className="font-mono">{'{{lastName}}'}</code>, <code className="font-mono">{'{{phone}}'}</code>, <code className="font-mono">{'{{email}}'}</code> — remplacées automatiquement par les données de chaque contact à l'envoi.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 mb-2">Destinataires</label>
            <div className="flex space-x-2 mb-3">
              <button
                type="button"
                onClick={() => setMode('group')}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'group' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Users className="w-4 h-4 mr-2" /> Groupe de contacts
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'manual' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Smartphone className="w-4 h-4 mr-2" /> Numéros manuels
              </button>
            </div>

            {mode === 'group' ? (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="gem-input w-full"
              >
                {groups.length === 0 ? (
                  <option value="">Aucun groupe disponible</option>
                ) : (
                  groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.contact_count} contacts)</option>
                  ))
                )}
              </select>
            ) : (
              <textarea
                value={manualNumbers}
                onChange={(e) => setManualNumbers(e.target.value)}
                rows={4}
                placeholder="+22376123456, +33612345678&#10;Séparés par virgule, point-virgule ou retour à la ligne"
                className="gem-input w-full resize-none"
              />
            )}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 mb-2">Moment d'envoi</label>
            <div className="flex space-x-2 mb-3">
              <button
                type="button"
                onClick={() => setScheduleEnabled(false)}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${!scheduleEnabled ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Send className="w-4 h-4 mr-2" /> Envoyer maintenant
              </button>
              <button
                type="button"
                onClick={() => setScheduleEnabled(true)}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${scheduleEnabled ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Calendar className="w-4 h-4 mr-2" /> Programmer
              </button>
            </div>
            {scheduleEnabled && (
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="gem-input w-full"
                required={scheduleEnabled}
              />
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/campaigns')}
              className="gem-btn-ghost"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={sending || recipientCount === 0}
              className="gem-btn-primary flex items-center disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {scheduleEnabled ? 'Programmer la campagne' : 'Envoyer la campagne'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="gem-card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-brand-500" /> Aperçu SMS
            </h3>
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[90%]">
                {message || 'Votre message apparaîtra ici...'}
              </div>
              <div className="text-[10px] text-gray-500 mt-1 text-right">Aperçu</div>
            </div>
          </div>

          <div className="gem-card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
              <Info className="w-4 h-4 mr-2 text-gem-purple" /> Résumé
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Destinataires</span>
                <span className="font-semibold text-gray-800">{recipientCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Segments par SMS</span>
                <span className="font-semibold text-gray-800">{smsSegments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total segments</span>
                <span className="font-semibold text-brand-600">{recipientCount * smsSegments}</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between">
                <span className="text-gray-500">Coût estimé</span>
                <span className="font-semibold text-gray-800">{(recipientCount * smsSegments * 0.05).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
