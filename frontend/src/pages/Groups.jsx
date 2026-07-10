import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Users, Loader2, FolderPlus, Edit3, ArrowRight } from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'

const groupColors = [
  'from-brand-400 to-brand-600',
  'from-gem-purple to-purple-700',
  'from-gem-teal to-teal-700',
  'from-gem-amber to-orange-600',
  'from-gem-pink to-pink-700',
  'from-indigo-400 to-indigo-600',
]

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [editGroup, setEditGroup] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups')
      setGroups(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/groups', { name, description })
      setName('')
      setDescription('')
      fetchGroups()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce groupe ?')) return
    try {
      await api.delete(`/groups/${id}`)
      fetchGroups()
    } catch (err) {
      console.error(err)
    }
  }

  const openEdit = (g) => {
    setEditGroup(g)
    setEditForm({ name: g.name, description: g.description || '' })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/groups/${editGroup.id}`, editForm)
      setEditGroup(null)
      fetchGroups()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Groupes de contacts</h2>
        <p className="text-sm text-gray-500 mt-1">Organisez vos contacts en groupes pour un envoi ciblé</p>
      </div>

      <form onSubmit={handleSubmit} className="gem-card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom du groupe</label>
            <input
              placeholder="Ex: Clients VIP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="gem-input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <input
              placeholder="Description optionnelle"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="gem-input w-full"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="gem-btn-primary w-full flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" /> Créer le groupe
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderPlus className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun groupe</h3>
          <p className="text-sm text-gray-500">Créez votre premier groupe de contacts ci-dessus</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g, i) => (
            <div key={g.id} className="gem-card p-6 group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${groupColors[i % groupColors.length]} rounded-xl flex items-center justify-center shadow-sm`}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(g)} className="text-gray-400 hover:text-brand-600">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(g.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{g.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{g.description || 'Aucune description'}</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-600">
                  <span className="font-bold text-gray-800">{g.contact_count}</span> contact{g.contact_count > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-400">{new Date(g.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <Link
                to={`/contacts?groupId=${g.id}`}
                className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Voir les contacts <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} title="Modifier le groupe">
        <form onSubmit={handleEditSave} className="space-y-3">
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="gem-input w-full"
            placeholder="Nom du groupe"
            required
          />
          <input
            type="text"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            className="gem-input w-full"
            placeholder="Description optionnelle"
          />
          <button type="submit" className="gem-btn-primary w-full">Enregistrer</button>
        </form>
      </Modal>
    </div>
  )
}
