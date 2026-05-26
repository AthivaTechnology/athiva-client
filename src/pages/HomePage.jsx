import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
    CalendarDays, MapPin, Clock, Search,
    Ticket, ChevronDown, Zap, AlertCircle
} from 'lucide-react'
import { API_ENDPOINTS } from '../config/api'
import { formatDate, getStatusStyle, getLowestPrice } from '../utils/format'

function formatTime12h(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function HomeSkeleton() {
    return (
        <div className="animate-pulse max-w-6xl mx-auto px-6 py-12">
            <div className="h-6 w-32 bg-app-surface-2 rounded-md mb-8"></div>
            <div className="flex justify-between items-center mb-8">
                <div className="h-10 w-48 bg-app-surface-2 rounded-lg"></div>
                <div className="h-10 w-64 bg-app-surface-2 rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="border border-app-border rounded-2xl overflow-hidden bg-app-surface shadow-organic">
                        <div className="h-40 bg-app-surface-2 w-full mb-4"></div>
                        <div className="p-5 space-y-4">
                            <div className="h-5 bg-app-surface-2 rounded-md w-3/4"></div>
                            <div className="h-4 bg-app-surface-2 rounded-md w-1/2"></div>
                            <div className="pt-4 border-t border-app-border/50 flex justify-between">
                                <div className="h-3 bg-app-surface-2 rounded w-16"></div>
                                <div className="h-3 bg-app-surface-2 rounded w-16"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function HomePage() {
    const [events, setEvents] = useState([])
    const [clientName, setClientName] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [siteDisabled, setSiteDisabled] = useState(false)
    const [search, setSearch] = useState('')
    const eventsRef = useRef(null)

    useEffect(() => {
        axios.get(API_ENDPOINTS.events())
            .then(({ data }) => {
                setEvents(data.data || [])
                if (data.client_name) {
                    setClientName(data.client_name)
                    document.title = `Events — ${data.client_name}`
                }
            })
            .catch((err) => {
                if (err.response?.status === 403) {
                    setSiteDisabled(true)
                } else if (err.response?.status === 404) {
                    setError(err.response?.data?.detail || 'This domain is not registered with our platform.')
                } else {
                    setError('Failed to load events. Please try again.')
                }
            })
            .finally(() => setLoading(false))
        return () => { document.title = 'Events' }
    }, [])

    const filtered = events.filter(ev =>
        ev.name?.toLowerCase().includes(search.toLowerCase())
    )

    const featured = events[0]


    return (
        <div className="bg-app-bg">
            {/* ══════════════════════════════════════════════
                HERO — Refined Organic Light Theme
            ══════════════════════════════════════════════ */}
            <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 px-5 bg-app-surface border-b border-app-border">
                <div className="absolute inset-0 bg-[radial-gradient(var(--app-border)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />

                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-brand-600/5 border border-brand-400/20 text-brand-600 text-[9px] font-bold tracking-[0.15em] uppercase mb-5 backdrop-blur-sm">
                        <Zap size={10} className="fill-brand-600" />
                        {clientName || 'Latest Discovery'}
                    </div>

                    <h1 className="font-outfit text-3xl md:text-5xl font-bold tracking-tight mb-5 text-app-text leading-[1.1]">
                        Experience the <br className="hidden sm:block" />
                        <span className="text-brand-600">Extraordinary</span>
                    </h1>

                    <p className="text-[15px] md:text-base text-app-text-muted max-w-lg mx-auto mb-8 leading-relaxed font-medium">
                        Curated professional events, masterclasses, and gatherings designed to inspire and connect.
                    </p>

                    <button
                        onClick={() => eventsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="inline-flex items-center gap-2 font-semibold text-[13px] px-5 py-2.5 rounded-full bg-app-text text-app-surface hover:bg-[#1A1817] hover:-translate-y-0.5 transition-all shadow-organic"
                    >
                        Explore Events <ChevronDown size={14} />
                    </button>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                ALL EVENTS GRID
            ══════════════════════════════════════════════ */}
            <section ref={eventsRef} className="py-12 md:py-16">
                <div className="max-w-6xl mx-auto px-6">
                    {loading && <HomeSkeleton />}

                    {siteDisabled && (
                        <div className="text-center py-20 max-w-md mx-auto">
                            <div className="w-16 h-16 mx-auto mb-5 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-200">
                                <AlertCircle size={32} className="text-amber-500" />
                            </div>
                            <h2 className="font-outfit text-2xl font-bold text-app-text mb-3">
                                Site Unavailable
                            </h2>
                            <p className="text-app-text-muted text-sm leading-relaxed mb-2">
                                This site has been temporarily disabled by the administrator.
                            </p>
                            <p className="text-app-text-faint text-xs">
                                Please check back later or contact support for more information.
                            </p>
                        </div>
                    )}

                    {error && !siteDisabled && (
                        <div className="text-center py-12 bg-red-50 border border-red-100 rounded-2xl max-w-lg mx-auto">
                            <p className="text-red-500 font-medium text-sm">{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <>
                            <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4 mb-10">
                                <div>
                                    <h2 className="font-outfit text-2xl md:text-3xl font-bold text-app-text">
                                        Upcoming
                                        <span className="text-sm font-medium text-app-text-faint ml-2">({filtered.length})</span>
                                    </h2>
                                </div>
                                <div className="relative w-full md:w-64">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-faint" />
                                    <input
                                        type="text"
                                        placeholder="Search events..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-full text-sm bg-app-surface border border-app-border text-app-text placeholder-app-text-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {filtered.length === 0 ? (
                                <div className="text-center py-20 bg-app-surface rounded-3xl border border-app-border shadow-sm">
                                    <Ticket size={32} className="mx-auto mb-3 text-app-border" />
                                    <p className="font-medium text-app-text mb-1">No matching events</p>
                                    <p className="text-sm text-app-text-muted">Try adjusting your search</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                                    {filtered.map((ev) => {
                                        const sold      = ev.total_sold || 0
                                        const total     = ev.total_capacity || 0
                                        const remaining = ev.total_remaining || 0
                                        const percent   = total > 0 ? Math.min(100, (sold / total) * 100) : 0
                                        const dateInfo  = formatDate(ev.start?.unix)
                                        const endInfo   = formatDate(ev.end?.unix)
                                        const price     = getLowestPrice(ev.ticket_types)

                                        const isSoldOut   = total > 0 && remaining === 0
                                        const isLow       = total > 0 && remaining > 0 && remaining <= 5

                                        return (
                                            <Link
                                                key={ev.id}
                                                to={`/events/${ev.id}`}
                                                className={`group event-card flex flex-col bg-app-surface ${isSoldOut ? 'opacity-80' : ''}`}
                                            >
                                                <div className="relative h-40 bg-app-surface-2 flex items-center justify-center overflow-hidden border-b border-app-border">
                                                    <CalendarDays size={48} className="text-app-border group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500" strokeWidth={1} />

                                                    {/* Sold-out overlay */}
                                                    {isSoldOut && (
                                                        <div className="absolute inset-0 bg-app-surface-2/60 flex items-center justify-center">
                                                            <span className="px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-md">
                                                                Sold Out
                                                            </span>
                                                        </div>
                                                    )}

                                                    {dateInfo && (
                                                        <div className="absolute top-3 left-3 bg-app-surface/90 backdrop-blur-sm border border-app-border/50 shadow-sm rounded-lg px-3 py-1.5 text-center">
                                                            <p className="font-outfit text-sm font-bold text-app-text leading-tight">{dateInfo.day}</p>
                                                            <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest">{dateInfo.month}</p>
                                                            {ev.start?.time && <p className="text-[9px] font-semibold text-app-text-muted mt-0.5">{formatTime12h(ev.start.time)}</p>}
                                                        </div>
                                                    )}

                                                    {price && !isSoldOut && (
                                                        <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-[10px] font-bold bg-app-text text-app-surface shadow-sm">
                                                            {price === 'Free' ? 'FREE' : price}
                                                        </div>
                                                    )}

                                                    {ev.status && !isSoldOut && (() => {
                                                        const { label, cls } = getStatusStyle(ev.status)
                                                        return (
                                                            <div className="absolute bottom-3 left-3">
                                                                <span className={`inline-block px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${cls}`}>
                                                                    {label}
                                                                </span>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>

                                                <div className="p-5 flex-1 flex flex-col">
                                                    <h3 className={`font-outfit text-base font-bold mb-3 line-clamp-2 leading-snug transition-colors ${isSoldOut ? 'text-app-text-muted' : 'text-app-text group-hover:text-brand-600'}`}>
                                                        {ev.name}
                                                    </h3>

                                                    <div className="space-y-1.5 mb-5 mt-auto">
                                                        {dateInfo && (
                                                            <div className="flex items-center gap-2 text-[13px] text-app-text-muted">
                                                                <Clock size={12} className="text-brand-500 shrink-0" />
                                                                <span className="truncate"><span className="text-app-text-faint text-[11px] font-semibold uppercase tracking-wider mr-1">Start</span>{dateInfo.full}{ev.start?.time ? `, ${formatTime12h(ev.start.time)}` : ''}</span>
                                                            </div>
                                                        )}
                                                        {endInfo && (
                                                            <div className="flex items-center gap-2 text-[13px] text-app-text-muted">
                                                                <Clock size={12} className="text-app-text-faint shrink-0" />
                                                                <span className="truncate"><span className="text-app-text-faint text-[11px] font-semibold uppercase tracking-wider mr-1">End</span>{endInfo.full}{ev.end?.time ? `, ${formatTime12h(ev.end.time)}` : ''}</span>
                                                            </div>
                                                        )}
                                                        {ev.venue?.name && (
                                                            <div className="flex items-center gap-2 text-[13px] text-app-text-muted">
                                                                <MapPin size={12} className="text-brand-500 shrink-0" />
                                                                <span className="truncate">{ev.venue.name}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {total > 0 && (
                                                        <div className="pt-4 border-t border-app-border/50">
                                                            {isSoldOut ? (
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Sold Out</span>
                                                                    <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Join Waitlist →</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex justify-between text-[10px] font-bold text-app-text-faint uppercase tracking-wider mb-1.5">
                                                                        <span>
                                                                            {sold > 0 ? `${sold} issued` : ''}
                                                                        </span>
                                                                        <span className={isLow ? 'text-amber-600' : ''}>
                                                                            {isLow ? `Only ${remaining} left!` : `${remaining} left`}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-1 w-full rounded-full bg-app-surface-2 overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                                                                            style={{ width: `${Math.max(2, percent)}%` }}
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}
