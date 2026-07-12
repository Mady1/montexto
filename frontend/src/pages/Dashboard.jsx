import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Calendar, Loader2, Send, CheckCircle, XCircle, Clock, Mail, Users, BookOpen, TrendingUp, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../services/api'

function StatBox({ title, icon: Icon, stats, linkTo, linkText, color }) {
  const successRate = stats.success_rate || 0
  const total = stats.total_sent || 0
  const deliveredPct = total > 0 ? Math.round((stats.delivered / total) * 100) : 0
  const failedPct = total > 0 ? Math.round((stats.failed / total) * 100) : 0

  return (
    <div className="gem-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 flex items-center"><Send className="w-3.5 h-3.5 mr-1.5 text-gray-400" /> Total envoyé{title === 'SMS' ? '' : 's'}</span>
          <span className="text-brand-600 font-semibold font-serif tabular-nums">{stats.total_sent}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1.5 text-green-400" /> Délivrés</span>
          <span className="text-green-600 font-semibold font-serif tabular-nums">{stats.delivered}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 flex items-center"><XCircle className="w-3.5 h-3.5 mr-1.5 text-red-400" /> Échoués</span>
          <span className="text-red-600 font-semibold font-serif tabular-nums">{stats.failed}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 flex items-center"><Clock className="w-3.5 h-3.5 mr-1.5 text-orange-400" /> En attente</span>
          <span className="text-orange-600 font-semibold font-serif tabular-nums">{stats.pending}</span>
        </div>
        <div className="pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500 flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1.5 text-brand-400" /> {title === 'SMS' ? 'Taux de succès' : "Taux d'ouverture"}</span>
            <span className="text-green-600 font-bold font-serif tabular-nums">{successRate} %</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-green-500" style={{ width: `${deliveredPct}%` }}></div>
            <div className="bg-red-400" style={{ width: `${failedPct}%` }}></div>
          </div>
        </div>
      </div>
      <Link to={linkTo} className="mt-5 flex items-center justify-end text-sm text-gray-500 hover:text-brand-600 transition-colors">
        {linkText} <ArrowUpRight className="w-4 h-4 ml-1" />
      </Link>
    </div>
  )
}

function StatTile({ eyebrow, value, icon: Icon }) {
  return (
    <div className="gem-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="eyebrow text-xs">{eyebrow}</span>
        <Icon className="w-4 h-4 text-gray-300" />
      </div>
      <div className="font-serif text-3xl font-semibold text-gray-800 tabular-nums">{value}</div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchStats()
  }, [startDate, endDate])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await api.get('/stats/dashboard', { params: { startDate, endDate } })
      setStats(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = (stats?.chart || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    count: d.count,
  }))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <span className="eyebrow text-sm block mb-1">Journal de transmission</span>
          <h2 className="text-2xl font-semibold text-gray-800">Vue d'ensemble</h2>
          <p className="text-sm text-gray-500 mt-1">Suivez vos performances SMS et mail</p>
        </div>
        <div className="flex items-center space-x-2 surface-translucent backdrop-blur rounded-full px-4 py-2 border">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border-none outline-none text-gray-600 bg-transparent" />
          <span className="text-gray-300">→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border-none outline-none text-gray-600 bg-transparent" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatTile icon={Send} eyebrow="SMS envoyés" value={stats?.sms?.total_sent || 0} />
            <StatTile icon={Users} eyebrow="Groupes" value={stats?.groups || 0} />
            <StatTile icon={BookOpen} eyebrow="Contacts" value={stats?.contacts || 0} />
            <StatTile icon={Mail} eyebrow="Mails envoyés" value={stats?.mail?.total_sent || 0} />
          </div>

          <div className="gem-card p-6 mb-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-500" />
                <h3 className="text-base font-semibold text-gray-800">Activité d'envoi</h3>
              </div>
              <span className="text-xs text-gray-400">{chartData.reduce((s, d) => s + d.count, 0)} SMS sur la période</span>
            </div>
            {chartData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Activity className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                Aucun envoi pour cette période
              </div>
            ) : (
              <div className="h-64 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="dashActivityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--gem-accent)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--gem-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gem-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gem-subtle)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gem-subtle)' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--gem-border)', background: 'var(--gem-surface)', fontSize: '13px' }} />
                    <Area type="monotone" dataKey="count" name="SMS" stroke="var(--gem-accent)" strokeWidth={2.25} fill="url(#dashActivityFill)" dot={{ r: 3, fill: 'var(--gem-accent)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <StatBox title="SMS" icon={Send} stats={stats?.sms || { total_sent: 0, delivered: 0, failed: 0, pending: 0, success_rate: 0 }} linkTo="/campaigns" linkText="Liste de SMS" color="bg-brand-500" />
            <StatBox title="MAILS" icon={Mail} stats={stats?.mail || { total_sent: 0, delivered: 0, failed: 0, pending: 0, opened: 0, success_rate: 0, open_rate: 0 }} linkTo="/campaigns" linkText="Liste des MAILS" color="bg-gem-amber" />
          </div>

          <div className="gem-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Historiques des rechargements</h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{(stats?.recharges || []).length} transaction(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Références</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Montant</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Moyens de paiement</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-xs uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recharges || []).length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-gray-400">Aucun rechargement pour cette période</td>
                    </tr>
                  ) : (
                    stats.recharges.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-700 font-mono text-xs">#{r.id}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 font-serif tabular-nums">{Number(r.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA</td>
                        <td className="px-4 py-3 text-gray-600">{r.payment_method || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
