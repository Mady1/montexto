import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Search, BookOpen, FileText } from 'lucide-react'
import api from '../services/api'

export default function Catalog() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await api.get('/catalog')
      setItems(res.data.data || [])
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
      console.error(err)
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
                <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
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
    </div>
  )
}
