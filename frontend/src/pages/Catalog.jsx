import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Search, BookOpen, FileText, Edit3 } from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

export default function Catalog() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', content: '' })

  useEffect(() => {
    fetchItems()
  }, [page])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await api.get('/catalog', { params: { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } })
      setItems(res.data.data || [])
      setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / PAGE_SIZE)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/catalog', { name, content, type: 'sms' })
      setName('')
      setContent('')
      setPage(1)
      fetchItems()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce modèle ?')) return
    try {
      await api.delete(`/catalog/${id}`)
      fetchItems()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const openEdit = (item) => {
    setEditItem(item)
    setEditForm({ name: item.name, content: item.content })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/catalog/${editItem.id}`, { name: editForm.name, content: editForm.content, type: editItem.type })
      setEditItem(null)
      fetchItems()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Catalogue de messages</h2>
        <p className="text-sm text-gray-500 mt-1">Modèles de messages réutilisables pour vos campagnes</p>
      </div>

      <form onSubmit={handleSubmit} className="gem-card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom du modèle</label>
            <input
              placeholder="Ex: Bienvenue"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="gem-input w-full"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Contenu du message</label>
            <input
              placeholder="Bonjour, bienvenue sur..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="gem-input w-full"
              required
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Variables disponibles : <code className="font-mono">{'{{firstName}}'}</code>, <code className="font-mono">{'{{lastName}}'}</code>, <code className="font-mono">{'{{phone}}'}</code>, <code className="font-mono">{'{{email}}'}</code>
            </p>
          </div>
          <div className="flex items-end">
            <button type="submit" className="gem-btn-primary w-full flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" /> Ajouter
            </button>
          </div>
        </div>
      </form>

      <div className="flex items-center surface-translucent backdrop-blur rounded-full px-4 py-2.5 mb-4 border">
        <Search className="w-4 h-4 text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Rechercher un modèle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm border-none outline-none placeholder:text-gray-400"
        />
        {search && <span className="text-xs text-gray-400">{filtered.length} résultat(s)</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun modèle</h3>
          <p className="text-sm text-gray-500">Créez votre premier modèle de message ci-dessus</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="gem-card p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-gem-teal to-teal-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm">{item.name}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-brand-600">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-3 bg-gray-50 rounded-xl p-3">{item.content}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="gem-badge bg-gray-100 text-gray-500 uppercase">{item.type}</span>
                <span className="text-xs text-gray-400">{item.content.length} caractères</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Modifier le modèle">
        <form onSubmit={handleEditSave} className="space-y-3">
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="gem-input w-full"
            placeholder="Nom du modèle"
            required
          />
          <textarea
            value={editForm.content}
            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
            rows={4}
            className="gem-input w-full resize-none"
            placeholder="Contenu du message"
            required
          />
          <button type="submit" className="gem-btn-primary w-full">Enregistrer</button>
        </form>
      </Modal>
    </div>
  )
}
