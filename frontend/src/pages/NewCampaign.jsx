import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, Users, Smartphone, MessageSquare, Info, ArrowLeft } from 'lucide-react'
import api from '../services/api'

export default function NewCampaign() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('group')
  const [groupId, setGroupId] = useState('')
  const [manualNumbers, setManualNumbers] = useState('')
  const [groups, setGroups] = useState([])
  const [sending, setSending] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchGroups()
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
      await api.post('/campaigns', payload)
      navigate('/campaigns')
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
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
                placeholder="+2250123456789, +33612345678&#10;Séparés par virgule, point-virgule ou retour à la ligne"
                className="gem-input w-full resize-none"
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
              Envoyer la campagne
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
