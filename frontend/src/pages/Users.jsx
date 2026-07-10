import { useState, useEffect } from 'react'
import api from '../services/api'
import { Shield, Plus, Trash2, Edit3, X, Search, Lock, Mail, Phone, Building2, Unlock, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

export default function Users() {
  const { hasRole, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', organization_id: '', role_id: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    if (hasRole('super_admin')) fetchOrgs()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users', { params: { search } })
      setUsers(res.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles')
      setRoles(res.data.data || [])
    } catch (err) {}
  }

  const fetchOrgs = async () => {
    try {
      const res = await api.get('/organizations')
      setOrgs(res.data.data || [res.data])
    } catch (err) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          organization_id: form.organization_id || undefined,
          role_id: form.role_id || undefined,
        })
      } else {
        await api.post('/users', form)
      }
      setShowForm(false)
      setEditUser(null)
      setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', organization_id: '', role_id: '' })
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const handleEdit = (u) => {
    setEditUser(u)
    setForm({
      email: u.email,
      password: '',
      firstName: u.first_name || u.firstName || '',
      lastName: u.last_name || u.lastName || '',
      phone: u.phone || '',
      organization_id: u.organization_id || u.organizationId || '',
      role_id: u.role_id || u.roleId || '',
    })
    setShowForm(true)
  }

  const handleUnlock = async (id) => {
    try {
      await api.put(`/users/${id}`, { status: 'active' })
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    try {
      await api.delete(`/users/${id}`)
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const roleColors = {
    super_admin: 'bg-red-50 text-red-600',
    org_admin: 'bg-purple-50 text-purple-600',
    resp_com: 'bg-blue-50 text-blue-600',
    operator: 'bg-emerald-50 text-emerald-600',
    auditor: 'bg-amber-50 text-amber-600',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            className="gem-input pl-10 w-full max-w-md"
          />
        </div>
        <button onClick={() => { setEditUser(null); setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', organization_id: '', role_id: '' }); setShowForm(true) }} className="gem-btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="gem-card p-12 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucun utilisateur</p>
        </div>
      ) : (
        <div className="gem-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rôle</th>
                {hasRole('super_admin') && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Organisation</th>}
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Dernière connexion</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-gem-purple rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {(u.first_name || u.firstName || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{`${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() || u.email}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`gem-badge ${roleColors[u.role_name] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role_display_name || u.role_name || '—'}
                    </span>
                  </td>
                  {hasRole('super_admin') && (
                    <td className="px-5 py-3 text-sm text-gray-600">{u.organization_name || '—'}</td>
                  )}
                  <td className="px-5 py-3">
                    <span className={`gem-badge ${u.status === 'active' ? 'bg-emerald-50 text-emerald-600' : u.status === 'locked' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                      {u.status === 'active' ? 'Actif' : u.status === 'locked' ? 'Verrouillé' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('fr-FR') : 'Jamais'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {u.status === 'locked' && (
                        <button onClick={() => handleUnlock(u.id)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Déverrouiller">
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(u)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={`${editUser ? 'Modifier' : 'Nouvel'} utilisateur`}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!editUser && (
            <>
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="gem-input w-full" required />
              <input type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="gem-input w-full" required />
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="gem-input w-full" />
            <input type="text" placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="gem-input w-full" />
          </div>
          <input type="tel" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="gem-input w-full" />
          <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="gem-input w-full">
            <option value="">— Sélectionner un rôle —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.display_name}</option>
            ))}
          </select>
          {hasRole('super_admin') && (
            <select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })} className="gem-input w-full">
              <option value="">— Sélectionner une organisation —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="gem-btn-primary w-full">{editUser ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  )
}
