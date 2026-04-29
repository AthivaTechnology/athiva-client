import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, CalendarDays, MapPin, Ticket, Clock, Users, ExternalLink, AlertCircle, Plus, Minus, ChevronDown } from 'lucide-react'
import { useRef } from 'react'
import { API_ENDPOINTS } from '../config/api'

async function submitWaitlist(eventId, ticketTypeId, email) {
    const res = await axios.post(API_ENDPOINTS.waitlist(eventId), { email, ticket_type_id: ticketTypeId })
    return res.data
}

function EventSkeleton() {
    return (
        <div className="animate-pulse space-y-0">
            {/* Header Skeleton */}
            <div className="border-b border-app-border bg-app-bg">
                <div className="max-w-4xl mx-auto px-5 py-8 md:py-12">
                    <div className="w-24 h-4 bg-app-surface-2 skeleton-shimmer rounded mb-8"></div>
                    <div className="w-16 h-6 bg-app-surface-2 skeleton-shimmer rounded-full mb-4"></div>
                    <div className="w-3/4 h-12 md:h-16 bg-app-surface-2 skeleton-shimmer rounded-xl mb-6"></div>
                    <div className="flex gap-4">
                        <div className="w-32 h-5 bg-app-surface-2 skeleton-shimmer rounded"></div>
                        <div className="w-24 h-5 bg-app-surface-2 skeleton-shimmer rounded"></div>
                    </div>
                </div>
            </div>
            {/* Body Skeleton */}
            <div className="max-w-4xl mx-auto px-5 py-8 lg:py-12 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
                <div className="md:col-span-7 lg:col-span-8 space-y-10">
                    <div className="w-32 h-8 bg-app-surface-2 skeleton-shimmer rounded mb-6"></div>
                    <div className="h-32 bg-app-surface-2 skeleton-shimmer rounded-2xl"></div>
                    <div className="h-32 bg-app-surface-2 skeleton-shimmer rounded-2xl"></div>
                </div>
                <div className="md:col-span-5 lg:col-span-4 space-y-6">
                    <div className="h-64 bg-app-surface-2 skeleton-shimmer rounded-3xl"></div>
                    <div className="h-48 bg-app-surface-2 skeleton-shimmer rounded-3xl"></div>
                </div>
            </div>
        </div>
    )
}

export default function EventDetailPage() {
    const { eventId } = useParams()
    const [event, setEvent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedTickets, setSelectedTickets] = useState({})
    const [waitlistEmails, setWaitlistEmails] = useState({})
    const [waitlistStatus, setWaitlistStatus] = useState({})
    const [waitlistErrors, setWaitlistErrors] = useState({})

    const descriptionRef = useRef(null)
    const [showScrollIndicator, setShowScrollIndicator] = useState(false)

    const handleQuantityChange = (ttId, delta, available, maxPerOrder) => {
        setSelectedTickets(prev => {
            const current = prev[ttId] || 0;
            const maxAllowed = Math.min(maxPerOrder, available);
            const next = Math.max(0, Math.min(maxAllowed, current + delta));
            if (next === 0) {
                const copy = { ...prev };
                delete copy[ttId];
                return copy;
            }
            return { ...prev, [ttId]: next };
        });
    }

    useEffect(() => {
        // Three-speed polling strategy:
        //   15s on first check after load (catches a hold created just before page opened)
        //   15s when holds active (time-sensitive — tracks expiry accurately)
        //   60s when no holds and already done the first check (saves requests when idle)
        const POLL_SLOW = 60000
        const POLL_FAST = 30000

        let timer = null

        // isFirstPoll=true forces POLL_FAST once regardless of hold state
        const schedulePoll = (hasHolds, isFirstPoll = false) => {
            clearTimeout(timer)
            timer = setTimeout(fetchAndReschedule, (hasHolds || isFirstPoll) ? POLL_FAST : POLL_SLOW)
        }

        const fetchAndReschedule = () => {
            if (document.visibilityState === 'hidden') return
            axios.get(API_ENDPOINTS.event(eventId))
                .then(({ data }) => {
                    setEvent(data)
                    const hasHolds = (data?.ticket_types || []).some(t => t.held_count > 0)
                    schedulePoll(hasHolds)
                })
                .catch(() => {})
        }

        // Initial load — schedule first poll at 30s regardless of hold state
        axios.get(API_ENDPOINTS.event(eventId))
            .then(({ data }) => {
                setEvent(data)
                if (data?.name) document.title = data.name
                const hasHolds = (data?.ticket_types || []).some(t => t.held_count > 0)
                schedulePoll(hasHolds, true)
            })
            .catch(() => setError('Event not found.'))
            .finally(() => setLoading(false))

        // Resume immediately when tab becomes visible
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchAndReschedule()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)

        // Re-fetch when browser restores page from bfcache (Back button from Stripe)
        // Without this, the frozen DOM snapshot shows stale data (Sold Out instead of being processed)
        const onPageShow = (e) => {
            if (e.persisted) fetchAndReschedule()
        }
        window.addEventListener('pageshow', onPageShow)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            window.removeEventListener('pageshow', onPageShow)
            document.title = 'Events'
        }
    }, [eventId])

    // Scroll indicator check
    useEffect(() => {
        const checkScroll = () => {
            if (descriptionRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = descriptionRef.current
                setShowScrollIndicator(scrollHeight > clientHeight + scrollTop + 5)
            }
        }

        if (!loading && event?.description) {
            setTimeout(checkScroll, 100)
            const ref = descriptionRef.current
            if (ref) {
                ref.addEventListener('scroll', checkScroll)
                window.addEventListener('resize', checkScroll)
                return () => {
                    ref.removeEventListener('scroll', checkScroll)
                    window.removeEventListener('resize', checkScroll)
                }
            }
        }
    }, [loading, event?.description])

    const scrollToBottom = () => {
        if (descriptionRef.current) {
            descriptionRef.current.scrollTo({
                top: descriptionRef.current.scrollHeight,
                behavior: 'smooth'
            })
        }
    }

    if (loading) return <EventSkeleton />

    if (error || !event) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100 mb-2">
                <AlertCircle size={32} className="text-red-500" />
            </div>
            <h1 className="font-outfit text-2xl font-bold text-gray-900">Event Not Found</h1>
            <p className="text-gray-500 text-sm max-w-sm">The event you're looking for doesn't exist or may have been removed.</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-2 font-semibold text-sm bg-white text-gray-900 border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                <ArrowLeft size={14} /> Back to Directory
            </Link>
        </div>
    )

    const totalSold     = (event.total_sold || 0) + (event.total_held || 0)
    const totalCapacity = event.total_capacity || 0
    const percentTotal = totalCapacity > 0 ? Math.min(100, (totalSold / totalCapacity) * 100) : 0

    const formatEventDate = (start) => {
        if (!start?.date) return { date: 'TBA', time: '' }
        const d = new Date(start.date)
        return {
            date: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            time: start.time || ''
        }
    }

    const { date: eventDate, time: eventTime } = formatEventDate(event.start)

    return (
        <div className="bg-app-bg">

            {/* ── Header ───────────────────────────────────────────── */}
            <header className="relative border-b border-app-border bg-app-surface overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-4xl mx-auto px-5 py-8 md:py-12 relative z-10">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-app-text-muted hover:text-app-text text-[10px] font-bold uppercase tracking-[0.15em] transition-colors mb-6 group">
                        <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> Events
                    </Link>

                    <div className="space-y-4 animate-fade-up">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-brand-600/10 text-brand-600">{event.status}</span>
                            {event.venue?.name && (
                                <span className="text-xs font-medium text-app-text-muted flex items-center gap-1.5">
                                    <MapPin size={13} className="text-brand-500" /> {event.venue.name}
                                </span>
                            )}
                        </div>

                        <h1 className="font-outfit text-2xl md:text-4xl lg:text-5xl font-bold text-app-text tracking-tight leading-[1.1] max-w-3xl">
                            {event.name}
                        </h1>

                        <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-app-text-muted">
                            <span className="flex items-center gap-1.5">
                                <CalendarDays size={14} className="text-brand-500" /> {eventDate}
                            </span>
                            {eventTime && (
                                <span className="flex items-center gap-1.5">
                                    <Clock size={14} className="text-brand-500" /> {eventTime}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Content Grid ─────────────────────────────────────── */}
            <div className="max-w-4xl mx-auto px-5 py-8 lg:py-12 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">

                {/* Main column */}
                <div className="md:col-span-7 lg:col-span-8 space-y-10 animate-fade-up-delay-1">

                    {/* Ticket Tiers */}
                    {event.ticket_types?.length > 0 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="font-outfit text-2xl font-bold text-app-text">Select Tickets</h2>
                            </div>

                            <div className="space-y-4">
                                {event.ticket_types.map((tt) => {
                                    const capacity = tt.quantity || 0
                                    const sold = tt.quantity_sold || 0
                                    const available = tt.quantity_available != null ? tt.quantity_available : Math.max(0, capacity - sold)
                                    const percent = capacity > 0 ? Math.min(100, (sold / capacity) * 100) : 0
                                    const held = tt.held_count || 0
                                    const isLow = available > 0 && available <= 10
                                    const isHeldOut = available <= 0 && held > 0
                                    const isSoldOut = available <= 0 && held === 0 && capacity > 0
                                    const minPerOrder = tt.min_per_order || 1
                                    const maxPerOrder = tt.max_per_order || 10

                                    return (
                                        <div key={tt.id} className="group bg-app-surface border border-app-border p-4 rounded-[1.25rem] hover:border-brand-400/40 hover:shadow-organic transition-all duration-300 relative overflow-hidden">
                                            {isSoldOut && (
                                                <div className="absolute inset-0 bg-app-surface-2/50 pointer-events-none" />
                                            )}
                                            {isHeldOut && (
                                                <div className="absolute inset-0 bg-amber-50/40 pointer-events-none" />
                                            )}

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                                <div className="flex-1">
                                                    <p className="font-outfit text-base font-bold text-app-text mb-1.5 group-hover:text-brand-600 transition-colors">
                                                        {tt.name}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider font-bold">
                                                        {isSoldOut ? (
                                                            <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded">Sold Out</span>
                                                        ) : isHeldOut ? (
                                                            <span className="text-amber-600 bg-amber-100 px-2 py-0.5 rounded">⏳ {held} being processed</span>
                                                        ) : sold === 0 ? (
                                                            <span className="text-brand-600 bg-brand-600/10 px-2 py-0.5 rounded">New Release</span>
                                                        ) : (
                                                            <span className="text-app-text-muted">{sold} booked</span>
                                                        )}
                                                        {available > 0 && (
                                                            <span className={isLow ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded' : 'text-app-text-muted'}>
                                                                {isLow ? `Last ${available}` : `${available} left`}
                                                            </span>
                                                        )}
                                                        {held > 0 && !isHeldOut && (
                                                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                                                🔒 {held} being reserved
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isHeldOut && (
                                                        <p className="text-[10px] text-amber-600 mt-1.5 normal-case tracking-normal font-medium">
                                                            May become available — page updates automatically
                                                        </p>
                                                    )}
                                                    {isSoldOut && (
                                                        <div className="mt-2 relative z-10">
                                                            {waitlistStatus[tt.id] === 'success' ? (
                                                                <p className="text-[11px] font-semibold text-emerald-600">✓ You're on the waitlist!</p>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="email"
                                                                        placeholder="your@email.com"
                                                                        value={waitlistEmails[tt.id] || ''}
                                                                        onChange={e => setWaitlistEmails(prev => ({ ...prev, [tt.id]: e.target.value }))}
                                                                        className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-app-border bg-app-bg text-app-text placeholder-app-text-faint focus:outline-none focus:border-brand-400/60 min-w-0"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={waitlistStatus[tt.id] === 'loading'}
                                                                        onClick={async () => {
                                                                            const email = (waitlistEmails[tt.id] || '').trim()
                                                                            if (!email || !email.includes('@')) {
                                                                                setWaitlistErrors(prev => ({ ...prev, [tt.id]: 'Enter a valid email.' }))
                                                                                return
                                                                            }
                                                                            setWaitlistErrors(prev => ({ ...prev, [tt.id]: '' }))
                                                                            setWaitlistStatus(prev => ({ ...prev, [tt.id]: 'loading' }))
                                                                            try {
                                                                                await submitWaitlist(eventId, tt.id, email)
                                                                                setWaitlistStatus(prev => ({ ...prev, [tt.id]: 'success' }))
                                                                            } catch {
                                                                                setWaitlistStatus(prev => ({ ...prev, [tt.id]: 'error' }))
                                                                                setWaitlistErrors(prev => ({ ...prev, [tt.id]: 'Could not sign up. Try again.' }))
                                                                            }
                                                                        }}
                                                                        className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-app-text text-app-surface hover:opacity-80 disabled:opacity-50 transition-opacity"
                                                                    >
                                                                        {waitlistStatus[tt.id] === 'loading' ? '...' : 'Notify Me'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {waitlistErrors[tt.id] && waitlistStatus[tt.id] !== 'success' && (
                                                                <p className="text-[10px] text-red-500 mt-1">{waitlistErrors[tt.id]}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                                                    <p className={`font-outfit text-xl font-black ${tt.price > 0 ? 'text-app-text' : 'text-emerald-700'}`}>
                                                        {tt.price > 0 ? `$${(tt.price / 100).toFixed(2)}` : 'FREE'}
                                                    </p>

                                                    {available > 0 && (
                                                        <div className="flex items-center gap-1.5 bg-app-surface-2 rounded-lg p-1 border border-app-border/50">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuantityChange(tt.id, -1, available, maxPerOrder)}
                                                                disabled={(selectedTickets[tt.id] || 0) <= 0}
                                                                className="w-7 h-7 rounded-md flex items-center justify-center bg-app-surface border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-surface-2 disabled:opacity-30 transition-all shadow-sm"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <span className="font-outfit font-bold text-[13px] w-5 text-center text-app-text">{selectedTickets[tt.id] || 0}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuantityChange(tt.id, 1, available, maxPerOrder)}
                                                                disabled={(selectedTickets[tt.id] || 0) >= Math.min(maxPerOrder, available)}
                                                                className="w-7 h-7 rounded-md flex items-center justify-center bg-app-surface border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-surface-2 disabled:opacity-30 transition-all shadow-sm"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {capacity > 0 && (
                                                <div className="mt-3.5 pt-3.5 border-t border-app-border/50 relative z-10">
                                                    <div className="h-1 w-full rounded-full bg-app-surface-2 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ${isSoldOut ? 'bg-app-border' : 'bg-brand-500'}`}
                                                            style={{ width: `${Math.max(1, percent)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div className="space-y-4">
                            <h2 className="font-outfit text-2xl font-bold text-app-text">About</h2>
                            <div className="relative group/desc">
                                <div
                                    ref={descriptionRef}
                                    className="prose prose-sm md:prose-base text-app-text-muted prose-a:text-brand-600 hover:prose-a:text-brand-500 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar"
                                    style={{ whiteSpace: 'pre-line', scrollBehavior: 'smooth' }}
                                >
                                    <div dangerouslySetInnerHTML={{
                                        __html: event.description.replace(/•([^\s\n])/g, '\n• $1')
                                    }} />
                                </div>

                                {showScrollIndicator && (
                                    <button
                                        onClick={scrollToBottom}
                                        className="absolute bottom-4 right-6 w-9 h-9 rounded-full bg-white border border-app-border flex items-center justify-center text-app-text-muted hover:text-brand-600 hover:border-brand-400/40 transition-all duration-300 shadow-lg animate-bounce"
                                        title="Scroll to bottom"
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Sidebar ──────────────────────────────────────── */}
                <div className="md:col-span-5 lg:col-span-4 space-y-6 animate-fade-up-delay-2 md:sticky md:top-24 self-start">

                    <div className="bg-app-surface rounded-[1.25rem] p-5 md:p-6 border border-app-border shadow-organic relative overflow-hidden">
                        <div className="space-y-5 relative z-10">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-app-text-faint mb-1.5">When</p>
                                <p className="font-outfit text-base font-bold text-app-text">{eventDate}</p>
                                {eventTime && <p className="text-xs font-medium text-app-text-muted mt-0.5">{eventTime}</p>}
                            </div>

                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-app-text-faint mb-1.5">Where</p>
                                <p className="font-outfit text-base font-bold text-app-text">{event.venue?.name || 'TBA'}</p>
                                {event.venue?.city && <p className="text-xs font-medium text-app-text-muted mt-0.5">{event.venue.city}</p>}
                            </div>

                            <div className="pt-5 border-t border-app-border">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-app-text-faint mb-1.5">Attendance</p>
                                        {totalSold === 0 ? (
                                            <p className="text-[11px] font-bold text-brand-600">Be the first!</p>
                                        ) : (
                                            <p className="font-outfit text-lg font-bold text-app-text">{totalSold}<span className="text-app-text-faint font-medium text-xs ml-1">/ {totalCapacity || '∞'}</span></p>
                                        )}
                                    </div>
                                    <div className="w-8 h-8 bg-brand-600/10 rounded-lg flex items-center justify-center text-brand-600 border border-brand-400/20">
                                        <Users size={16} />
                                    </div>
                                </div>
                                {totalCapacity > 0 && (
                                    <div className="h-1.5 w-full rounded-full bg-app-surface-2 overflow-hidden">
                                        <div
                                            className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.max(2, percentTotal)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CTA box */}
                    <div className="rounded-[1.25rem] bg-app-text p-5 md:p-6 text-app-surface relative shadow-organic">
                        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />

                        {event.ticket_types?.length > 0 ? (() => {
                            const allSoldOut = event.ticket_types.every(tt => {
                                const cap = tt.quantity || 0
                                const avail = tt.quantity_available != null ? tt.quantity_available : Math.max(0, cap - (tt.quantity_sold || 0))
                                const hld = tt.held_count || 0
                                return avail <= 0 && hld === 0 && cap > 0
                            })
                            return (
                                <div className="relative z-10">
                                    {allSoldOut ? (
                                        <div className="py-2 text-center text-white">
                                            <p className="font-outfit text-lg font-bold mb-1">Sold Out</p>
                                            <p className="text-white/60 text-xs">Join the waitlist on individual tickets above</p>
                                        </div>
                                    ) : Object.keys(selectedTickets).length > 0 ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-black/20 rounded-lg p-2.5 border border-white/10 text-white">
                                                <span className="text-[13px] font-medium">{Object.values(selectedTickets).reduce((a, b) => a + b, 0)} tickets</span>
                                                <span className="font-outfit text-base font-bold">${(Object.entries(selectedTickets).reduce((acc, [id, qty]) => {
                                                    const t = event.ticket_types.find(x => x.id === id);
                                                    return acc + (t ? (t.price || 0) * qty : 0);
                                                }, 0) / 100).toFixed(2)}</span>
                                            </div>
                                            <Link
                                                to={`/checkout?eventId=${eventId}&tickets=${encodeURIComponent(JSON.stringify(selectedTickets))}`}
                                                className="block w-full text-center bg-app-surface text-app-text font-bold py-3 rounded-lg hover:bg-app-surface-2 transition-colors shadow-sm text-[13px]"
                                            >
                                                Checkout
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="py-2 text-center text-white">
                                            <p className="font-outfit text-lg font-bold mb-1">Ready to book?</p>
                                            <p className="text-white/60 text-xs">Select tickets to proceed</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })() : (
                            <div className="py-2 text-center relative z-10 text-white">
                                <p className="font-outfit text-lg font-bold mb-1">Coming Soon</p>
                                <p className="text-white/60 text-xs">Booking opens shortly</p>
                            </div>
                        )}

                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-5 text-center relative z-10 flex items-center justify-center gap-1.5">
                            <Lock size={10} /> Secure Stripe Checkout
                        </p>
                    </div>

                </div>
            </div>
        </div>
    )
}

function Lock({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}
