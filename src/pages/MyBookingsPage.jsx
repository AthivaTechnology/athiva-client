import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Ticket, Search, CalendarDays, ArrowRight, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { API_ENDPOINTS } from '../config/api'

export default function MyBookingsPage() {
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState('')
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        document.title = 'My Bookings'
        return () => { document.title = 'Events' }
    }, [])

    const handleSearch = (e) => {
        e.preventDefault()
        if (!email.trim()) return
        setLoading(true)
        setError('')
        setBookings([])
        setSubmitted(email.trim())
        axios.get(API_ENDPOINTS.bookings(email.trim()))
            .then(({ data }) => setBookings(data.bookings || []))
            .catch(() => setError('Could not load bookings. Please check your email and try again.'))
            .finally(() => setLoading(false))
    }

    const getStatusStyle = (status) => {
        switch (status) {
            case 'complete': return { label: 'Confirmed', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
            case 'pending':  return { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200' }
            default:         return { label: status,      cls: 'bg-gray-100 text-gray-500 border-gray-200' }
        }
    }

    return (
        <div className="bg-app-bg min-h-[70vh]">
            <div className="max-w-2xl mx-auto px-5 py-12">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="font-outfit text-2xl md:text-3xl font-bold text-app-text mb-2">My Bookings</h1>
                    <p className="text-[13px] text-app-text-muted">Enter the email address you used to purchase tickets.</p>
                </div>

                {/* Search form */}
                <form onSubmit={handleSearch} className="flex gap-2.5 mb-8">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-faint" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="jane@example.com"
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-app-surface border border-app-border text-app-text placeholder-app-text-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all text-[13px] font-medium"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 bg-app-text text-app-surface font-bold rounded-lg text-[13px] hover:bg-[#1A1817] transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm shrink-0"
                    >
                        {loading ? 'Searching...' : 'Find Tickets'}
                    </button>
                </form>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[13px] mb-6">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {/* Results */}
                {!loading && submitted && !error && (
                    <>
                        {bookings.length === 0 ? (
                            <div className="text-center py-16 bg-app-surface rounded-2xl border border-app-border">
                                <Ticket size={32} className="mx-auto mb-3 text-app-border" />
                                <p className="font-medium text-app-text mb-1">No bookings found</p>
                                <p className="text-[13px] text-app-text-muted">No tickets were found for <strong>{submitted}</strong>.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-app-text-faint mb-4">
                                    {bookings.length} booking{bookings.length !== 1 ? 's' : ''} for {submitted}
                                </p>
                                {bookings.map((b) => {
                                    const { label, cls } = getStatusStyle(b.status)
                                    const date = b.created_at ? new Date(b.created_at + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
                                    return (
                                        <div key={b.id} className="bg-app-surface border border-app-border rounded-[1.25rem] p-4 flex items-start gap-4 shadow-sm hover:border-brand-400/30 transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-brand-600/10 border border-brand-400/20 flex items-center justify-center text-brand-600 shrink-0 mt-0.5">
                                                <Ticket size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                                    <p className="font-outfit font-bold text-[14px] text-app-text line-clamp-1">{b.event_name || 'Event'}</p>
                                                    <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>{label}</span>
                                                </div>
                                                <p className="text-[12px] text-app-text-muted mb-2">{b.ticket_type_name} × {b.quantity}</p>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 text-[11px] text-app-text-faint font-medium">
                                                        {date && (
                                                            <span className="flex items-center gap-1">
                                                                <CalendarDays size={11} /> {date}
                                                            </span>
                                                        )}
                                                        {b.total_amount_cents > 0 && (
                                                            <span>${(b.total_amount_cents / 100).toFixed(2)}</span>
                                                        )}
                                                    </div>
                                                    {b.event_id && (
                                                        <Link
                                                            to={`/events/${b.event_id}`}
                                                            className="text-[11px] font-bold text-brand-600 hover:text-brand-500 flex items-center gap-1 transition-colors"
                                                        >
                                                            View event <ArrowRight size={11} />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
