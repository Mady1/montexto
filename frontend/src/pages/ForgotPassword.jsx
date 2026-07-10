import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Mail, ArrowRight, ArrowLeft, Sparkles, CheckCircle, KeyRound } from 'lucide-react'
import api from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [devToken, setDevToken] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/password/reset-request', { email })
      setSent(true)
      if (res.data.devToken) setDevToken(res.data.devToken)
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-brand-100/50 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-gem-purple/15 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="glass-card rounded-3xl p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-400 via-gem-purple to-gem-pink rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Montexto</h1>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-base font-medium text-gray-700">Demande envoyée</h2>
              <p className="text-sm text-gray-500">
                Si l'email existe, un lien de réinitialisation a été envoyé à <span className="font-medium text-gray-700">{email}</span>
              </p>
              {devToken && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
                    <KeyRound className="w-3 h-3" /> Token de réinitialisation (démo)
                  </div>
                  <code className="text-xs text-amber-600 break-all font-mono">{devToken}</code>
                  <button
                    onClick={() => navigate(`/reset-password?token=${devToken}`)}
                    className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Réinitialiser maintenant →
                  </button>
                </div>
              )}
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-medium text-gray-600 mb-6 text-center">Mot de passe oublié</h2>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="gem-input w-full pl-11"
                      placeholder="vous@exemple.com"
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="gem-btn-primary w-full flex items-center justify-center disabled:opacity-60">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Envoyer le lien <ArrowRight className="w-4 h-4 ml-2" /></>}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
