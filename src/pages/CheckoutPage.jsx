import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
    Ticket, MapPin, Clock, CalendarDays, ArrowLeft,
    ShieldCheck, AlertCircle
} from 'lucide-react'
import { API_ENDPOINTS } from '../config/api'

function CheckoutSkeleton() {
    return (
        <div className="max-w-5xl mx-auto py-12 px-6 lg:px-12 animate-pulse">
            <div className="w-24 h-4 bg-app-surface-2 rounded mb-12"></div>
            <div className="flex justify-between items-end mb-10">
                <div className="w-48 h-10 bg-app-surface-2 rounded-xl"></div>
                <div className="w-32 h-8 bg-app-surface-2 rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7">
                    <div className="h-96 bg-app-surface-2 rounded-[1.5rem] border border-app-border p-8">
                        <div className="w-48 h-6 bg-app-surface-2 rounded mb-8"></div>
                        <div className="space-y-6">
                            <div className="h-14 bg-app-surface-2 rounded-xl"></div>
                            <div className="h-14 bg-app-surface-2 rounded-xl"></div>
                            <div className="h-14 bg-app-surface-2 rounded-xl"></div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5">
                    <div className="h-64 bg-app-surface-2 rounded-[1.5rem] border border-app-border p-6"></div>
                </div>
            </div>
        </div>
    )
}

// ── Cross-tab checkout lock ───────────────────────────────────────────────
const CHECKOUT_LOCK_KEY = 'athiva_checkout_lock'
const LOCK_TTL_MS = 35_000

const tryAcquireLock = () => {
    const raw = localStorage.getItem(CHECKOUT_LOCK_KEY)
    if (raw) {
        const t = Number(raw)
        if (!isNaN(t) && Date.now() - t < LOCK_TTL_MS) return false
    }
    localStorage.setItem(CHECKOUT_LOCK_KEY, String(Date.now()))
    return true
}

const releaseLock = () => localStorage.removeItem(CHECKOUT_LOCK_KEY)

const waitForLock = () =>
    new Promise((resolve) => {
        const onStorage = (e) => {
            if (e.key === CHECKOUT_LOCK_KEY && !e.newValue) {
                window.removeEventListener('storage', onStorage)
                resolve()
            }
        }
        window.addEventListener('storage', onStorage)
    })
// ─────────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const eventId = searchParams.get('eventId')
    const ticketsParam = searchParams.get('tickets')

    const selectedTickets = useMemo(() => {
        if (!ticketsParam) return {};
        try {
            return JSON.parse(ticketsParam);
        } catch (e) {
            console.error('Failed to parse tickets param:', e);
            return {};
        }
    }, [ticketsParam]);

    const [event, setEvent] = useState(null)
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [nameError, setNameError] = useState('')
    const [checkoutError, setCheckoutError] = useState('')
    const [processing, setProcessing] = useState(false)
    const [returnedFromStripe, setReturnedFromStripe] = useState(false)
    const submittingRef = useRef(false)  // Additional guard against double submission
    const [reservation, setReservation] = useState(null) // { url, expiresAt: Date, heldQuantity }
    const [timeLeft, setTimeLeft] = useState(null) // seconds remaining
    const [resumeSession, setResumeSession] = useState(null) // { stripeUrl, expiresAt, sessionId } if back-button detected
    const [resumeTimeLeft, setResumeTimeLeft] = useState(null) // seconds remaining for resume banner
    const [showTerms, setShowTerms] = useState(false)
    const [waitingForTab, setWaitingForTab] = useState(false)
    const redirectedRef = useRef(false)  // true only after window.location.href redirect fires

    const refreshResumeSession = (currentEventId) => {
        try {
            const raw = sessionStorage.getItem('tt_hold')
            if (!raw) {
                setResumeSession(null)
                return
            }
            const hold = JSON.parse(raw)
            const expiresAt = hold.expiresAt ? new Date(hold.expiresAt) : null
            if (
                hold.stripeUrl &&
                hold.eventId === currentEventId &&
                expiresAt &&
                expiresAt > new Date()
            ) {
                // Silently check if payment already completed — if so, clear and hide banner
                if (hold.sessionId) {
                    axios.get(API_ENDPOINTS.checkoutSession(hold.sessionId))
                        .then(({ data }) => {
                            if (['complete', 'refunded', 'failed'].includes(data.status)) {
                                sessionStorage.removeItem('tt_hold')
                                setResumeSession(null)
                            }
                        })
                        .catch(() => {}) // network error — leave banner visible, user can cancel
                }
                setResumeSession({ stripeUrl: hold.stripeUrl, expiresAt, sessionId: hold.sessionId })
                return
            }
        } catch {}
        setResumeSession(null)
    }

    // Reset processing state when user returns from external redirect (e.g., Stripe)
    useEffect(() => {
        const handleVisibilityChange = () => {
            // Only reset if we actually redirected away — not during an in-progress API call
            if (document.visibilityState === 'visible' && processing && redirectedRef.current) {
                setProcessing(false)
                submittingRef.current = false
                redirectedRef.current = false
            }
            if (document.visibilityState === 'visible') {
                refreshResumeSession(eventId)
            }
        }

        const handleFocus = () => {
            // Only reset if we actually redirected away — not during an in-progress API call
            if (processing && redirectedRef.current) {
                setProcessing(false)
                submittingRef.current = false
                redirectedRef.current = false
            }
            refreshResumeSession(eventId)
        }

        // Primary bfcache restore signal — fires reliably across Chrome, Firefox, Safari
        // when the page is thawed from bfcache (browser Back from Stripe redirect)
        const handlePageShow = (e) => {
            if (e.persisted) {
                setProcessing(false)
                submittingRef.current = false
                setReturnedFromStripe(true)
            }
            refreshResumeSession(eventId)
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleFocus)
        window.addEventListener('pageshow', handlePageShow)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
            window.removeEventListener('pageshow', handlePageShow)
        }
    }, [processing])

    // Detect existing valid hold/session from sessionStorage (Back-button resume)
    useEffect(() => {
        refreshResumeSession(eventId)
    }, [eventId])

    useEffect(() => {
        if (!resumeSession) {
            setResumeTimeLeft(null)
            return
        }
        const tick = () => {
            const secs = Math.max(0, Math.floor((resumeSession.expiresAt - Date.now()) / 1000))
            setResumeTimeLeft(secs)
            // Auto-cancel when time reaches zero
            if (secs === 0) {
                let sessionId = resumeSession?.sessionId
                try {
                    const raw = sessionStorage.getItem('tt_hold')
                    if (raw) {
                        const hold = JSON.parse(raw)
                        sessionId = hold.sessionId || sessionId
                    }
                } catch {}
                if (sessionId) {
                    axios.post(API_ENDPOINTS.releaseHold(sessionId)).catch(() => {})
                }
                sessionStorage.removeItem('tt_hold')
                setResumeSession(null)
                setReturnedFromStripe(false)
                setCheckoutError('Your reservation has expired. Please start over.')
            }
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [resumeSession])

    useEffect(() => {
        if (!eventId || Object.keys(selectedTickets).length === 0) {
            const timer = setTimeout(() => {
                if (!eventId || Object.keys(selectedTickets).length === 0) {
                    navigate('/')
                }
            }, 100);
            return () => clearTimeout(timer);
        }

        axios.get(API_ENDPOINTS.event(eventId))
            .then(({ data }) => {
                setEvent(data)
                if (data?.name) document.title = `Checkout — ${data.name}`
                const selected = Object.keys(selectedTickets).map(id => {
                    const t = (data.ticket_types || []).find(x => x.id === id)
                    return t ? { ...t, quantity: selectedTickets[id] } : null
                }).filter(Boolean)

                if (selected.length === 0) {
                    setCheckoutError('Selected tickets not found. They may have been removed.')
                } else {
                    setTickets(selected)
                }
            })
            .catch(() => setCheckoutError('Failed to load event details.'))
            .finally(() => setLoading(false))
    }, [eventId, selectedTickets, navigate])

    // Countdown timer for ticket reservation hold
    useEffect(() => {
        if (!reservation) return
        let released = false
        const tick = () => {
            const secs = Math.max(0, Math.floor((reservation.expiresAt - Date.now()) / 1000))
            setTimeLeft(secs)
            if (secs === 0 && !released) {
                released = true
                // Release TT hold immediately so inventory is freed for other buyers
                axios.post(API_ENDPOINTS.releaseHold(reservation.sessionId)).catch(() => {})
                // Redirect back to event page — Stripe session is now expired too
                navigate(`/events/${eventId}?reservation=expired`)
            }
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [reservation, navigate, eventId])

    // Step 1: validate form → show T&C modal
    const handleCheckout = (e) => {
        e.preventDefault()
        if (submittingRef.current || processing) return
        if (!name.trim() || name.trim().split(/\s+/).length < 2) {
            setNameError('Enter your full name — e.g. John Doe')
            return
        }
        setNameError('')
        if (!email) {
            setCheckoutError('Please enter your email address.')
            return
        }
        setCheckoutError('')
        setShowTerms(true)
    }

    // Step 2: user accepted T&C → call API
    const handleAcceptTerms = async () => {
        setShowTerms(false)
        if (submittingRef.current || processing) return

        // Cross-tab lock: if another tab is processing, wait until it releases
        if (!tryAcquireLock()) {
            setWaitingForTab(true)
            await waitForLock()
            setWaitingForTab(false)
            // Another waiting tab may have acquired the lock first
            if (!tryAcquireLock()) {
                setCheckoutError('Another checkout just completed. Please try again.')
                return
            }
        }

        submittingRef.current = true
        setProcessing(true)
        setCheckoutError('')
        setReturnedFromStripe(false)

        try {
            const items = tickets.map(t => ({
                ticket_type_id: t.id,
                quantity: selectedTickets[t.id]
            }));

            // Get customer's timezone from browser
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const { data } = await axios.post(API_ENDPOINTS.checkoutCreate(), {
                event_id: eventId,
                items,
                customer_email: email,
                customer_name: name,
                customer_phone: phone,
                customer_timezone: tz
            })

            if (!data.url) {
                throw new Error('No redirect URL received from server.')
            }
            if (data.hold_expires_at) {
                // Store hold info + Stripe URL so Back-button resume works
                sessionStorage.setItem('tt_hold', JSON.stringify({
                    sessionId: data.session_id,
                    expiresAt: data.hold_expires_at,
                    stripeUrl: data.url,
                    eventId,
                }))
            }
            // Always go to Stripe immediately — T&C already covered the 10-min rule
            releaseLock()
            redirectedRef.current = true
            window.location.href = data.url
        } catch (err) {
            const detail = err.response?.data?.detail;
            let errMsg = 'Failed to initiate checkout. Please try again.';
            if (typeof detail === 'string') {
                if (detail.includes('Ticket Tailor issuance failed')) {
                    let ttMessage = detail;
                    try {
                        const jsonStrMatch = detail.match(/\{.*\}/);
                        if (jsonStrMatch) {
                            const parsed = JSON.parse(jsonStrMatch[0]);
                            if (parsed.message) ttMessage = parsed.message;
                        }
                    } catch (e) { }
                    errMsg = `Organizer configuration issue: We could not issue your ticket. Please contact the event organizer. (${ttMessage})`;
                } else {
                    errMsg = detail;
                }
            } else if (Array.isArray(detail)) {
                errMsg = detail.map(d => `${d.loc?.[d.loc.length - 1] || 'Field'}: ${d.msg}`).join(', ');
            }
            setCheckoutError(errMsg);
            releaseLock()
            submittingRef.current = false
            setProcessing(false)
        }
    }

    if (loading) return <CheckoutSkeleton />

    // Show reservation panel once hold is created
    if (reservation && timeLeft !== null) {
        const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
        const secs = String(timeLeft % 60).padStart(2, '0')
        const expired = timeLeft === 0

        return (
            <div className="max-w-md mx-auto py-16 px-6">
                {expired ? (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                        <div className="text-5xl mb-4">⏰</div>
                        <h2 className="font-outfit text-2xl font-bold text-red-800 mb-2">Hold Expired</h2>
                        <p className="text-gray-600 mb-6">
                            Your ticket reservation has expired. Please try again.
                        </p>
                        <a
                            href={`/events/${eventId}`}
                            className="block w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-700 transition-colors text-center"
                        >
                            Back to Event
                        </a>
                    </div>
                ) : (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                        <div className="text-5xl mb-4">🎟️</div>
                        <h2 className="font-outfit text-2xl font-bold text-green-800 mb-1">
                            {reservation.heldQuantity} ticket{reservation.heldQuantity > 1 ? 's' : ''} reserved!
                        </h2>
                        <p className="text-sm text-gray-500 mb-2">
                            Reserved for <span className="font-bold text-green-700">{mins}:{secs}</span>
                        </p>
                        <button
                            onClick={() => { window.location.href = reservation.url }}
                            className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors"
                        >
                            Go to Payment Now →
                        </button>
                    </div>
                )}
            </div>
        )
    }

    if (!event || tickets.length === 0) {
        return (
            <div className="max-w-md mx-auto py-24 px-6 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100 mx-auto mb-6">
                    <AlertCircle size={32} className="text-red-500" />
                </div>
                <h1 className="font-outfit text-2xl font-bold text-app-text mb-2">Unavailable</h1>
                <p className="text-app-text-muted text-sm mb-8">{checkoutError || 'This ticket is no longer available.'}</p>
                <Link to="/" className="inline-flex items-center gap-2 font-semibold text-sm bg-app-surface border border-app-border text-app-text px-6 py-3 rounded-xl hover:bg-app-surface-2 transition-colors shadow-sm">
                    Return to Directory
                </Link>
            </div>
        )
    }

    const totalPrice = tickets.reduce((sum, t) => sum + ((t.price || 0) / 100 * selectedTickets[t.id]), 0);

    const d = event.start?.date ? new Date(event.start.date) : null
    const dateStr = d ? d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null

    return (
        <>
        <div className="max-w-4xl mx-auto py-8 px-5 lg:px-8 animate-fade-up bg-app-bg">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-app-text-muted hover:text-app-text mb-6 transition-colors group">
                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-1" /> Back
            </button>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-app-border pb-6">
                <div>
                    <h1 className="font-outfit text-2xl md:text-3xl font-bold text-app-text tracking-tight">Checkout</h1>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex-shrink-0">
                    <ShieldCheck size={14} className="text-emerald-500" /> Secure SSL
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

                {/* ─── Left Column: Payment Form ─── */}
                <div className="lg:col-span-7 order-2 lg:order-1">
                    <div className="p-5 md:p-6 bg-app-surface border border-app-border shadow-organic rounded-[1.25rem]">
                        <h2 className="font-outfit text-lg font-bold text-app-text mb-5 flex items-center gap-3">
                            <span className="w-5 h-5 rounded bg-brand-600/10 text-brand-600 flex items-center justify-center text-[10px] font-bold border border-brand-400/20">1</span>
                            Your Details
                        </h2>

                        <form onSubmit={handleCheckout}>
                            {resumeSession && !checkoutError && (() => {
                                const secsLeft = resumeTimeLeft ?? Math.max(0, Math.floor((resumeSession.expiresAt - Date.now()) / 1000))
                                const mins = String(Math.floor(secsLeft / 60)).padStart(2, '0')
                                const secs = String(secsLeft % 60).padStart(2, '0')
                                return (
                                    <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                                        <p className="font-bold text-sm mb-1">Your tickets are still reserved</p>
                                        <p className="text-amber-700 mb-3 leading-relaxed">
                                            You have an active reservation expiring in <strong>{mins}:{secs}</strong>. Resume your payment or cancel to release these tickets.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { sessionStorage.removeItem('tt_hold'); window.location.href = resumeSession.stripeUrl }}
                                                className="flex-1 py-2 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors"
                                            >
                                                Resume Payment →
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    let sessionId = resumeSession?.sessionId
                                                    try {
                                                        const raw = sessionStorage.getItem('tt_hold')
                                                        if (raw) {
                                                            const hold = JSON.parse(raw)
                                                            sessionId = hold.sessionId || sessionId
                                                        }
                                                    } catch {}
                                                    console.log('[Cancel] sessionId:', sessionId)
                                                    if (sessionId) {
                                                        console.log('[Cancel] Calling releaseHold with:', API_ENDPOINTS.releaseHold(sessionId))
                                                        axios.post(API_ENDPOINTS.releaseHold(sessionId))
                                                            .then(res => console.log('[Cancel] Release success:', res.status))
                                                            .catch(err => console.error('[Cancel] Release failed:', err.message))
                                                    } else {
                                                        console.warn('[Cancel] No sessionId found!')
                                                    }
                                                    sessionStorage.removeItem('tt_hold')
                                                    setResumeSession(null)
                                                    setReturnedFromStripe(false)
                                                    setCheckoutError('')
                                                }}
                                                className="px-3 py-2 rounded-lg bg-amber-100 text-amber-800 font-semibold text-xs hover:bg-amber-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )
                            })()}
                            {!resumeSession && returnedFromStripe && !checkoutError && (
                                <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                                    <p className="font-medium leading-relaxed">
                                        You returned from payment. Your previous reservation has expired — you can book again below.
                                    </p>
                                </div>
                            )}
                            {checkoutError && (
                                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-start gap-2.5">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <p className="font-medium leading-relaxed">{checkoutError}</p>
                                </div>
                            )}

                            <div className="space-y-3.5 mb-6">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-app-text-muted mb-1.5">
                                        Full Name <span className="text-brand-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => { setName(e.target.value); if (nameError) setNameError('') }}
                                        placeholder="John Doe"
                                        className={`w-full px-3.5 py-2.5 rounded-lg bg-app-bg border text-app-text placeholder-app-text-faint focus:bg-app-surface focus:ring-2 transition-all font-medium text-[13px] ${nameError ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10' : 'border-app-border focus:border-brand-500 focus:ring-brand-500/10'}`}
                                    />
                                    {nameError && (
                                        <p className="mt-1.5 text-[11px] text-red-500 font-medium">{nameError}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-app-text-muted mb-1.5">
                                        Email Address <span className="text-brand-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="jane@example.com"
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-app-bg border border-app-border text-app-text placeholder-app-text-faint focus:bg-app-surface focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all font-medium text-[13px]"
                                    />
                                    <p className="text-[10px] font-medium text-app-text-faint mt-1.5 ml-1">
                                        Tickets will be sent here.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-app-text-muted mb-1.5">
                                        Phone Number <span className="text-brand-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="+44 7700 900000"
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-app-bg border border-app-border text-app-text placeholder-app-text-faint focus:bg-app-surface focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all font-medium text-[13px]"
                                    />
                                </div>
                            </div>

                            <div className="pt-5 border-t border-app-border">
                                <button
                                    type="submit"
                                    disabled={processing || waitingForTab}
                                    className="w-full flex items-center justify-center gap-2 bg-app-text text-app-surface font-bold py-3 rounded-lg hover:bg-[#1A1817] transition-colors disabled:opacity-50 disabled:pointer-events-none text-[13px] shadow-organic"
                                >
                                    {waitingForTab ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                            Waiting for another tab...
                                        </>
                                    ) : processing ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        totalPrice === 0 ? 'Get Free Ticket' : `Pay $${totalPrice.toFixed(2)}`
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* ─── Right Column: Order Summary ─── */}
                <div className="lg:col-span-5 order-1 lg:order-2 lg:sticky lg:top-24">
                    <div className="bg-app-bg border border-app-border rounded-[1.25rem] overflow-hidden shadow-sm">

                        <div className="p-5 border-b border-app-border bg-app-surface">
                            <h3 className="font-outfit text-base font-bold text-app-text mb-3 line-clamp-2">{event.name}</h3>

                            <div className="space-y-1.5 text-xs font-medium text-app-text-muted">
                                {dateStr && (
                                    <div className="flex items-center gap-2">
                                        <CalendarDays size={14} className="text-brand-500" />
                                        <span>{dateStr}</span>
                                    </div>
                                )}
                                {event.venue?.name && (
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-brand-500" />
                                        <span>{event.venue.name}</span>
                                    </div>
                                )}
                                {event.start?.time && (
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-brand-500" />
                                        <span>{event.start.time}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-app-text-faint mb-4">Summary</h4>

                            <div className="space-y-3.5 mb-5">
                                {tickets.map(t => {
                                    const qty = selectedTickets[t.id];
                                    const price = (t.price || 0) / 100;
                                    return (
                                        <div key={t.id} className="flex justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="font-outfit font-bold text-app-text text-[13px] mb-0.5">{t.name}</p>
                                                <p className="text-[10px] font-medium text-app-text-muted">${price.toFixed(2)} x {qty}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-outfit font-bold text-sm text-app-text">${(price * qty).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="bg-app-surface rounded-lg p-3.5 border border-app-border mt-4 flex items-center justify-between shadow-sm">
                                <span className="font-bold text-app-text text-[13px]">Total</span>
                                <span className="font-outfit font-black text-xl text-brand-600">${totalPrice.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* ── Terms & Conditions Modal ─────────────────────────── */}
        {showTerms && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowTerms(false)}
                />
                <div className="relative bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">

                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-app-border shrink-0">
                        <div>
                            <h2 className="font-outfit text-lg font-bold text-app-text">Booking Terms</h2>
                            <p className="text-[11px] text-app-text-muted mt-0.5">Please read before proceeding to payment</p>
                        </div>
                        <button
                            onClick={() => setShowTerms(false)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-2 transition-colors"
                        >✕</button>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto p-5 space-y-4">

                        <div className="flex gap-3">
                            <span className="text-xl shrink-0">⏱</span>
                            <div>
                                <p className="font-bold text-app-text text-[13px] mb-1">10-Minute Reservation</p>
                                <p className="text-[12px] text-app-text-muted leading-relaxed">
                                    Once you proceed, your tickets are reserved for <strong>10 minutes</strong>. If payment is not completed in time, your reservation is released and tickets become available to others.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="text-xl shrink-0">🚫</span>
                            <div>
                                <p className="font-bold text-app-text text-[13px] mb-1">No Refunds</p>
                                <p className="text-[12px] text-app-text-muted leading-relaxed">
                                    All ticket sales are <strong>final and non-refundable</strong> once payment is confirmed. Tickets cannot be cancelled or exchanged except where required by law or if the event is cancelled by the organiser.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="text-xl shrink-0">💳</span>
                            <div>
                                <p className="font-bold text-app-text text-[13px] mb-1">Payment Authorisation</p>
                                <p className="text-[12px] text-app-text-muted leading-relaxed">
                                    By proceeding, you authorise a charge of <strong>${totalPrice.toFixed(2)}</strong> to your payment method. Payments are processed securely via Stripe.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="text-xl shrink-0">📧</span>
                            <div>
                                <p className="font-bold text-app-text text-[13px] mb-1">Ticket Delivery</p>
                                <p className="text-[12px] text-app-text-muted leading-relaxed">
                                    Tickets will be sent to <strong>{email}</strong>. Please ensure this is correct — we cannot resend to a different address after purchase.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="text-xl shrink-0">📋</span>
                            <div>
                                <p className="font-bold text-app-text text-[13px] mb-1">Event Changes</p>
                                <p className="text-[12px] text-app-text-muted leading-relaxed">
                                    If the event is cancelled or significantly changed by the organiser, refund eligibility is determined by the organiser's policy.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-app-border shrink-0 space-y-2.5">
                        <button
                            onClick={handleAcceptTerms}
                            disabled={processing || waitingForTab}
                            className="w-full bg-app-text text-app-surface font-bold py-3 rounded-xl text-[13px] hover:bg-[#1A1817] transition-colors shadow-organic disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {waitingForTab ? 'Waiting for another tab...' : totalPrice === 0 ? 'I Accept — Get Free Ticket' : 'I Accept — Continue to Payment'}
                        </button>
                        <button
                            onClick={() => setShowTerms(false)}
                            className="w-full text-app-text-muted text-[12px] font-medium py-2 hover:text-app-text transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
