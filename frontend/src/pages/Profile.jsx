import { useState, useEffect } from 'react'
import { User, Mail, Phone, Lock, Save, Check, Building2, Shield, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' })
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [profileOk, setProfileOk] = useState(false)
  const [pwdOk, setPwdOk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setForm({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' })
    }
  }, [user])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setError('')
    setProfileOk(false)
    try {
      await api.put('/auth/me', form)
      await refreshUser()
      setProfileOk(true)
      setTimeout(() => setProfileOk(false), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePwdSave = async (e) => {
    e.preventDefault()
    if (pwd.newPassword !== pwd.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (pwd.newPassword.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères')
      return
    }
    setSavingPwd(true)
    setError('')
    setPwdOk(false)
    try {
      await api.put('/auth/me', {
        ...form,
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      })
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwdOk(true)
      setTimeout(() => setPwdOk(false), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setSavingPwd(false)
    }
  }

  if (!user) return null

  const roleColors = {
    super_admin: 'from-red-500 to-rose-600',
    org_admin: 'from-purple-500 to-violet-600',
    resp_com: 'from-blue-500 to-indigo-600',
    operator: 'from-emerald-500 to-teal-600',
    auditor: 'from-amber-500 to-orange-600',
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Profile header card */}
      <div className="gem-card p-6">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${roleColors[user.roleName] || 'from-gray-400 to-gray-600'} flex items-center justify-center text-white text-xl font-bold shadow-md`}>
            {(user.firstName?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">{`${user.firstName} ${user.lastName}`.trim() || user.email}</h2>
            <div className="flex items-center gap-2 mt-1">
              {user.roleDisplayName && (
                <span className="gem-badge bg-brand-50 text-brand-600 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {user.roleDisplayName}
                </span>
              )}
              {user.organizationName && (
                <span className="gem-badge bg-gray-100 text-gray-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {user.organizationName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Mail className="w-4 h-4 text-gray-400" />
            {user.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4 text-gray-400" />
            Membre depuis {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}
          </div>
          {user.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Phone className="w-4 h-4 text-gray-400" />
              {user.phone}
            </div>
          )}
          {user.lastLogin && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              Dernière connexion: {new Date(user.lastLogin).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
      </div>

      {/* Edit profile form */}
      <form onSubmit={handleProfileSave} className="gem-card p-6 space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <User className="w-5 h-5 text-brand-500" />
          Informations personnelles
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Prénom</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="gem-input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="gem-input w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Téléphone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="gem-input w-full"
            placeholder="+225..."
          />
        </div>
        <button type="submit" disabled={savingProfile} className="gem-btn-primary flex items-center gap-2 disabled:opacity-60">
          {savingProfile ? (
            'Enregistrement...'
          ) : profileOk ? (
            <><Check className="w-4 h-4" /> Enregistré !</>
          ) : (
            <><Save className="w-4 h-4" /> Enregistrer</>
          )}
        </button>
      </form>

      {/* Change password form */}
      <form onSubmit={handlePwdSave} className="gem-card p-6 space-y-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Lock className="w-5 h-5 text-gem-purple" />
          Changer le mot de passe
        </h3>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe actuel</label>
          <input
            type="password"
            value={pwd.currentPassword}
            onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
            className="gem-input w-full"
            placeholder="••••••••"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={pwd.newPassword}
              onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
              className="gem-input w-full"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirmer</label>
            <input
              type="password"
              value={pwd.confirmPassword}
              onChange={(e) => setPwd({ ...pwd, confirmPassword: e.target.value })}
              className="gem-input w-full"
              placeholder="••••••••"
              required
            />
          </div>
        </div>
        <button type="submit" disabled={savingPwd} className="gem-btn-primary flex items-center gap-2 disabled:opacity-60">
          {savingPwd ? (
            'Enregistrement...'
          ) : pwdOk ? (
            <><Check className="w-4 h-4" /> Mot de passe modifié !</>
          ) : (
            <><Lock className="w-4 h-4" /> Changer le mot de passe</>
          )}
        </button>
      </form>
    </div>
  )
}
