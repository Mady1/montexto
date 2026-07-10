import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Mail, Lock, Eye, EyeOff, User, ArrowRight, Sparkles, Building2, Phone } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', organizationName: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/register', form)
      login(res.data.token, res.data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gem-bg)] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-brand-100/50 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-gem-purple/15 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-40 left-1/4 w-[450px] h-[450px] bg-gem-pink/10 rounded-full blur-[110px]"></div>
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="glass-card rounded-3xl p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-400 via-gem-purple to-gem-pink rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Montexto</h1>
            <p className="text-sm text-gray-400 mt-1">Créez votre compte gratuit</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 flex-shrink-0"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Prénom</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                  <input name="firstName" value={form.firstName} onChange={handleChange} className="gem-input w-full pl-11" placeholder="Jean" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom</label>
                <input name="lastName" value={form.lastName} onChange={handleChange} className="gem-input w-full" placeholder="Dupont" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom de l'organisation</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                <input name="organizationName" value={form.organizationName} onChange={handleChange} className="gem-input w-full pl-11" placeholder="Ma société" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                <input type="email" name="email" value={form.email} onChange={handleChange} className="gem-input w-full pl-11" placeholder="vous@exemple.com" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Téléphone <span className="text-gray-300">(optionnel)</span></label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="gem-input w-full pl-11" placeholder="+225..." />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} className="gem-input w-full pl-11 pr-11" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="gem-btn-primary w-full flex items-center justify-center disabled:opacity-60 mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Créer mon compte <ArrowRight className="w-4 h-4 ml-2" /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Déjà un compte ? <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
