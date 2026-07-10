import { useState, useEffect } from 'react'
import api from '../services/api'
import { KeyRound, Shield, Plus, Trash2, X, Check, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

export default function Roles() {
  const { hasRole } = useAuth()
  const [roles, setRoles] = useState([])
  const [allPermissions, setAllPermissions] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const [rolePermissions, setRolePermissions] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRoles()
    fetchAllPermissions()
  }, [])

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const res = await api.get('/roles')
      setRoles(res.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllPermissions = async () => {
    try {
      const res = await api.get('/roles/permissions/all')
      setAllPermissions(res.data.data || [])
    } catch (err) {}
  }

  const openRole = async (role) => {
    try {
      const res = await api.get(`/roles/${role.id}`)
      setSelectedRole(res.data)
      setRolePermissions(new Set((res.data.permissions || []).map((p) => p.id)))
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const togglePermission = (permId) => {
    setRolePermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) next.delete(permId)
      else next.add(permId)
      return next
    })
  }

  const savePermissions = async () => {
    try {
      await api.put(`/roles/${selectedRole.id}/permissions`, { permissionIds: Array.from(rolePermissions) })
      setSelectedRole(null)
      fetchRoles()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce rôle ?')) return
    try {
      await api.delete(`/roles/${id}`)
      fetchRoles()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
  }

  const moduleColors = {
    users: 'text-brand-600 bg-brand-50',
    campaigns: 'text-gem-purple bg-gem-purple/10',
    contacts: 'text-gem-pink bg-gem-pink/10',
    sms: 'text-gem-teal bg-gem-teal/10',
    admin: 'text-red-600 bg-red-50',
    reporting: 'text-gem-amber bg-gem-amber/10',
    audit: 'text-slate-600 bg-slate-100',
  }

  const roleColors = {
    super_admin: 'from-red-500 to-rose-600',
    org_admin: 'from-purple-500 to-violet-600',
    resp_com: 'from-blue-500 to-indigo-600',
    operator: 'from-emerald-500 to-teal-600',
    auditor: 'from-amber-500 to-orange-600',
  }

  if (!hasRole('super_admin')) {
    return (
      <div className="gem-card p-12 text-center">
        <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Accès réservé au Super Administrateur</p>
      </div>
    )
  }

  const groupedPermissions = allPermissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = []
    acc[p.module].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-gray-800">{roles.length} rôles</h2>
        <p className="text-sm text-gray-500">Cliquez sur un rôle pour gérer ses permissions</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="gem-card p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openRole(role)}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${roleColors[role.name] || 'from-gray-400 to-gray-600'} flex items-center justify-center shadow-md`}>
                  <Shield className="w-6 h-6 text-white" />
                </div>
                {role.is_system ? (
                  <span className="gem-badge bg-gray-100 text-gray-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Système
                  </span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(role.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 className="font-bold text-gray-800 mb-1">{role.display_name}</h3>
              <p className="text-sm text-gray-500">{role.description}</p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedRole}
        onClose={() => setSelectedRole(null)}
        maxWidth="max-w-2xl"
        title={selectedRole ? `Permissions — ${selectedRole.display_name}` : ''}
      >
        {selectedRole && (
          <div className="max-h-[70vh] overflow-y-auto">
            <p className="text-sm text-gray-500 -mt-2 mb-4">{selectedRole.description}</p>
            <div className="space-y-4">
              {Object.entries(groupedPermissions).map(([module, perms]) => (
                <div key={module}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 capitalize">{module}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => togglePermission(p.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          rolePermissions.has(p.id)
                            ? 'bg-brand-50 text-brand-700 border border-brand-200'
                            : 'bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${rolePermissions.has(p.id) ? 'bg-brand-500 text-white' : 'bg-gray-200'}`}>
                          {rolePermissions.has(p.id) && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-left">{p.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setSelectedRole(null)} className="gem-btn-ghost px-4">Annuler</button>
              <button onClick={savePermissions} className="gem-btn-primary px-4">Enregistrer ({rolePermissions.size})</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
