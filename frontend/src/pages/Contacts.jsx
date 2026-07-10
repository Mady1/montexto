import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Upload, Search, Contact, Mail, Phone, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '../services/api'

const avatarColors = [
  'bg-gradient-to-br from-brand-400 to-brand-600',
  'bg-gradient-to-br from-gem-purple to-purple-700',
  'bg-gradient-to-br from-gem-teal to-teal-700',
  'bg-gradient-to-br from-gem-amber to-orange-600',
  'bg-gradient-to-br from-gem-pink to-pink-700',
  'bg-gradient-to-br from-indigo-400 to-indigo-600',
  'bg-gradient-to-br from-rose-400 to-rose-600',
  'bg-gradient-to-br from-cyan-400 to-cyan-600',
]

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', groupId: '' })
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [showCsv, setShowCsv] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [csvData, setCsvData] = useState(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [cRes, gRes] = await Promise.all([api.get('/contacts'), api.get('/groups')])
      setContacts(cRes.data.data || [])
      setGroups(gRes.data || [])
      if (gRes.data.length > 0) setForm((prev) => ({ ...prev, groupId: gRes.data[0].id }))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/contacts', form)
      setForm({ firstName: '', lastName: '', phone: '', email: '', groupId: form.groupId })
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    const lines = bulk.split('\n').filter(Boolean)
    const contacts = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim())
      return { phone: parts[0] || '', firstName: parts[1] || '', lastName: parts[2] || '', email: parts[3] || '' }
    }).filter((c) => c.phone)
    if (contacts.length === 0) return
    try {
      await api.post('/contacts/bulk', { contacts, groupId: form.groupId })
      setBulk('')
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce contact ?')) return
    try {
      await api.delete(`/contacts/${id}`)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = contacts.filter((c) =>
    `${c.first_name} ${c.last_name} ${c.phone} ${c.email || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Contacts</h2>
        <p className="text-sm text-gray-500 mt-1">Gérez votre carnet de contacts et importez en masse</p>
      </div>

      <div className="gem-card p-6 mb-6">
        <div className="flex space-x-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => { setShowBulk(false); setShowCsv(false) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!showBulk && !showCsv ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>Ajouter un contact</button>
          <button onClick={() => { setShowBulk(true); setShowCsv(false) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showBulk ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>Import multiple</button>
          <button onClick={() => { setShowCsv(true); setShowBulk(false) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showCsv ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>Import CSV</button>
        </div>

        {!showBulk ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Prénom" className="gem-input" />
            <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Nom" className="gem-input" />
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="+225..." className="gem-input" required />
            <select name="groupId" value={form.groupId} onChange={handleChange} className="gem-input">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="submit" className="gem-btn-primary flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" /> Ajouter
            </button>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit}>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={6}
              placeholder="téléphone,prénom,nom,email (un contact par ligne)&#10;Ex: +2250123456789,Jean,Dupont,jean@mail.com"
              className="gem-input w-full resize-none mb-3 font-mono text-sm"
            />
            <div className="flex items-center space-x-3">
              <select name="groupId" value={form.groupId} onChange={handleChange} className="gem-input">
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="submit" className="gem-btn-primary flex items-center">
                <Upload className="w-4 h-4 mr-2" /> Importer
              </button>
            </div>
          </form>
        ) : showCsv ? (
          <div className="space-y-4">
            {csvResult && (
              <div className={`rounded-xl p-4 flex items-center gap-3 ${csvResult.errors > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {csvResult.errors > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                <div className="text-sm">
                  <strong>{csvResult.inserted}</strong> importés, <strong>{csvResult.duplicates}</strong> doublons, <strong>{csvResult.errors}</strong> erreurs sur <strong>{csvResult.total}</strong> contacts
                </div>
              </div>
            )}
            {!csvData ? (
              <div
                onClick={() => document.getElementById('csv-file-input').click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-all"
              >
                <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Cliquez pour sélectionner un fichier CSV</p>
                <p className="text-xs text-gray-400 mt-1">Colonnes attendues: phone, firstName, lastName, email</p>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = async (ev) => {
                      const text = ev.target.result
                      try {
                        const res = await api.post('/imports/parse-csv', { csvText: text })
                        setCsvData(res.data)
                        setCsvResult(null)
                      } catch (err) {
                        alert(err.response?.data?.error || 'Erreur de parsing CSV')
                      }
                    }
                    reader.readAsText(file)
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <strong>{csvData.contacts.length}</strong> contacts détectés — Mapping auto: {' '}
                    {csvData.mapping.phone !== undefined && <span className="text-brand-600">phone</span>}
                    {csvData.mapping.firstName !== undefined && <span className="text-brand-600">, firstName</span>}
                    {csvData.mapping.lastName !== undefined && <span className="text-brand-600">, lastName</span>}
                    {csvData.mapping.email !== undefined && <span className="text-brand-600">, email</span>}
                  </div>
                  <button onClick={() => { setCsvData(null); setCsvResult(null) }} className="text-sm text-gray-400 hover:text-gray-600">Changer de fichier</button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Téléphone</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Prénom</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Nom</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {csvData.contacts.slice(0, 20).map((c, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-700">{c.phone}</td>
                          <td className="px-3 py-2 text-gray-500">{c.firstName || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{c.lastName || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{c.email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvData.contacts.length > 20 && <div className="p-2 text-center text-xs text-gray-400">...et {csvData.contacts.length - 20} de plus</div>}
                </div>
                <div className="flex items-center gap-3">
                  <select value={form.groupId} onChange={handleChange} className="gem-input">
                    <option value="">Aucun groupe</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button
                    onClick={async () => {
                      setCsvImporting(true)
                      setCsvResult(null)
                      try {
                        const res = await api.post('/imports/contacts', { contacts: csvData.contacts, groupId: form.groupId || null })
                        setCsvResult(res.data)
                        setCsvData(null)
                        fetchData()
                      } catch (err) {
                        alert(err.response?.data?.error || 'Erreur')
                      } finally {
                        setCsvImporting(false)
                      }
                    }}
                    disabled={csvImporting}
                    className="gem-btn-primary flex items-center"
                  >
                    {csvImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Importer {csvData.contacts.length} contacts
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center bg-white/80 backdrop-blur rounded-full px-4 py-2.5 mb-4 border border-gray-200/60">
        <Search className="w-4 h-4 text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Rechercher un contact..."
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
            <Contact className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun contact</h3>
          <p className="text-sm text-gray-500">Ajoutez votre premier contact ci-dessus</p>
        </div>
      ) : (
        <div className="gem-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Nom</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Téléphone</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Groupe</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${avatarColors[i % avatarColors.length]} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                        {(c.first_name?.[0] || c.phone?.[0] || '?').toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 flex items-center"><Phone className="w-3.5 h-3.5 mr-1.5 text-gray-400" />{c.phone}</span>
                  </td>
                  <td className="px-6 py-4">
                    {c.email ? <span className="text-gray-600 flex items-center"><Mail className="w-3.5 h-3.5 mr-1.5 text-gray-400" />{c.email}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    {groups.find((g) => g.id === c.group_id) ? (
                      <span className="gem-badge bg-brand-50 text-brand-600">{groups.find((g) => g.id === c.group_id)?.name}</span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDelete(c.id)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
