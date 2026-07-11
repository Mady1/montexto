import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Loader2, Upload, Search, Contact, Mail, Phone, FileSpreadsheet, CheckCircle2, AlertCircle, Edit3, Download, FolderInput } from 'lucide-react'
import api from '../services/api'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

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
  const [searchParams, setSearchParams] = useSearchParams()
  const groupFilter = searchParams.get('groupId') || ''
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', groupId: '', tags: '' })
  const [tagFilter, setTagFilter] = useState('')
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [showCsv, setShowCsv] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [csvData, setCsvData] = useState(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editContact, setEditContact] = useState(null)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '', groupId: '', tags: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkMoveGroupId, setBulkMoveGroupId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    fetchData()
    setSelectedIds([])
  }, [page, groupFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, gRes] = await Promise.all([
        api.get('/contacts', { params: { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, groupId: groupFilter || undefined } }),
        api.get('/groups'),
      ])
      setContacts(cRes.data.data || [])
      setTotalPages(Math.max(1, Math.ceil((cRes.data.total || 0) / PAGE_SIZE)))
      setGroups(gRes.data || [])
      if (gRes.data.length > 0) setForm((prev) => ({ ...prev, groupId: prev.groupId || gRes.data[0].id }))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const clearGroupFilter = () => {
    setPage(1)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('groupId')
      return next
    })
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/contacts', form)
      setForm({ firstName: '', lastName: '', phone: '', email: '', groupId: form.groupId, tags: '' })
      if (page === 1) fetchData()
      else setPage(1)
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

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === filtered.length ? [] : filtered.map((c) => c.id)))
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedIds.length} contact(s) ?`)) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/contacts/${id}`)))
      setSelectedIds([])
      fetchData()
    } catch (err) {
      alert('Erreur lors de la suppression groupée')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkMove = async () => {
    if (!bulkMoveGroupId) return
    setBulkBusy(true)
    try {
      await Promise.all(
        selectedIds.map((id) => {
          const c = contacts.find((x) => x.id === id)
          return api.put(`/contacts/${id}`, {
            firstName: c.first_name,
            lastName: c.last_name,
            phone: c.phone,
            email: c.email,
            tags: c.tags,
            groupId: bulkMoveGroupId,
          })
        })
      )
      setSelectedIds([])
      setBulkMoveGroupId('')
      fetchData()
    } catch (err) {
      alert('Erreur lors du déplacement groupé')
    } finally {
      setBulkBusy(false)
    }
  }

  const openEdit = (c) => {
    setEditContact(c)
    setEditForm({
      firstName: c.first_name || '',
      lastName: c.last_name || '',
      phone: c.phone || '',
      email: c.email || '',
      groupId: c.group_id || '',
      tags: c.tags || '',
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/contacts/${editContact.id}`, editForm)
      setEditContact(null)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDownloadTemplate = () => {
    const rows = [
      ['phone', 'firstName', 'lastName', 'email'],
      ['+22376123456', 'Jean', 'Dupont', 'jean.dupont@mail.com'],
      ['+33612345678', 'Marie', 'Martin', 'marie.martin@mail.com'],
    ]
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'modele_contacts.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const filtered = contacts.filter((c) => {
    const matchesSearch = `${c.first_name} ${c.last_name} ${c.phone} ${c.email || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesTag = !tagFilter || (c.tags || '').toLowerCase().split(',').map((t) => t.trim()).includes(tagFilter.toLowerCase().trim())
    return matchesSearch && matchesTag
  })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Contacts</h2>
        <p className="text-sm text-gray-500 mt-1">Gérez votre carnet de contacts et importez en masse</p>
      </div>

      <div className="gem-card p-6 mb-6">
        <div className="flex space-x-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => { setShowBulk(false); setShowCsv(false) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!showBulk && !showCsv ? 'bg-[var(--gem-surface)] text-brand-600 shadow-sm' : 'text-gray-500'}`}>Ajouter un contact</button>
          <button onClick={() => { setShowBulk(true); setShowCsv(false) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showBulk ? 'bg-[var(--gem-surface)] text-brand-600 shadow-sm' : 'text-gray-500'}`}>Import multiple</button>
          <button onClick={() => { setShowCsv(true); setShowBulk(false) }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showCsv ? 'bg-[var(--gem-surface)] text-brand-600 shadow-sm' : 'text-gray-500'}`}>Import CSV</button>
        </div>

        {!showBulk && !showCsv ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Prénom" className="gem-input" />
            <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Nom" className="gem-input" />
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="+223..." className="gem-input" required />
            <select name="groupId" value={form.groupId} onChange={handleChange} className="gem-input">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="submit" className="gem-btn-primary flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" /> Ajouter
            </button>
            <input name="tags" value={form.tags} onChange={handleChange} placeholder="Tags (séparés par virgule)" className="gem-input md:col-span-5" />
          </form>
        ) : showBulk ? (
          <form onSubmit={handleBulkSubmit}>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={6}
              placeholder="téléphone,prénom,nom,email (un contact par ligne)&#10;Ex: +22376123456,Jean,Dupont,jean@mail.com"
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
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDownloadTemplate() }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Télécharger un modèle CSV
                </button>
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

      <div className="flex items-center surface-translucent backdrop-blur rounded-full px-4 py-2.5 mb-4 border">
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

      <div className="flex items-center surface-translucent backdrop-blur rounded-full px-4 py-2.5 mb-4 border">
        <input
          type="text"
          placeholder="Filtrer par tag..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="flex-1 bg-transparent text-sm border-none outline-none placeholder:text-gray-400"
        />
        {tagFilter && <span className="text-xs text-gray-400">{filtered.length} résultat(s)</span>}
      </div>

      {groupFilter && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="gem-badge bg-brand-50 text-brand-600">
            Groupe : {groups.find((g) => String(g.id) === groupFilter)?.name || groupFilter}
          </span>
          <button onClick={clearGroupFilter} className="text-gray-400 hover:text-gray-600 text-xs underline">
            Retirer le filtre
          </button>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 gem-card p-3 mb-4">
          <span className="text-sm font-medium text-gray-600 px-2">{selectedIds.length} sélectionné(s)</span>
          <select value={bulkMoveGroupId} onChange={(e) => setBulkMoveGroupId(e.target.value)} className="gem-input py-1.5 text-sm">
            <option value="">Déplacer vers un groupe...</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button onClick={handleBulkMove} disabled={!bulkMoveGroupId || bulkBusy} className="gem-btn-secondary flex items-center gap-1.5 text-sm py-1.5 disabled:opacity-50">
            <FolderInput className="w-3.5 h-3.5" /> Déplacer
          </button>
          <button onClick={handleBulkDelete} disabled={bulkBusy} className="flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Supprimer
          </button>
          <button onClick={() => setSelectedIds([])} className="text-sm text-gray-400 hover:text-gray-600 ml-auto">Annuler</button>
        </div>
      )}

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
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Nom</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Téléphone</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Groupe</th>
                <th className="px-6 py-4 font-medium text-gray-400 text-xs uppercase tracking-wider">Tags</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="w-4 h-4 rounded"
                    />
                  </td>
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
                    {c.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                          <span key={t} className="gem-badge bg-gem-purple/10 text-gem-purple">{t}</span>
                        ))}
                      </div>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => openEdit(c)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal open={!!editContact} onClose={() => setEditContact(null)} title="Modifier le contact">
        <form onSubmit={handleEditSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={editForm.firstName}
              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              className="gem-input w-full"
              placeholder="Prénom"
            />
            <input
              type="text"
              value={editForm.lastName}
              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              className="gem-input w-full"
              placeholder="Nom"
            />
          </div>
          <input
            type="text"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            className="gem-input w-full"
            placeholder="Téléphone"
            required
          />
          <input
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            className="gem-input w-full"
            placeholder="Email"
          />
          <select
            value={editForm.groupId}
            onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })}
            className="gem-input w-full"
          >
            <option value="">Aucun groupe</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input
            type="text"
            value={editForm.tags}
            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
            className="gem-input w-full"
            placeholder="Tags (séparés par virgule)"
          />
          <button type="submit" className="gem-btn-primary w-full">Enregistrer</button>
        </form>
      </Modal>
    </div>
  )
}
