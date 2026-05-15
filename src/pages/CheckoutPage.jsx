import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import SignatureCanvas from 'react-signature-canvas'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
    MapPin, Clock, CalendarDays, ArrowLeft,
    ShieldCheck, AlertCircle, PenLine, Check, Type, ChevronDown
} from 'lucide-react'
import { API_ENDPOINTS } from '../config/api'
import {
    CHECKOUT_SESSION_TTL_MS,
    clearCheckoutSession,
    readCheckoutSession,
    saveCheckoutSession,
    parseTicketSelection,
} from '../utils/checkoutSession'

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

export default function CheckoutPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const eventId = searchParams.get('eventId')
    const ticketsParam = searchParams.get('tickets')

    const selectedTickets = useMemo(() => parseTicketSelection(ticketsParam), [ticketsParam])

    const [event, setEvent] = useState(null)
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [repeatEmail, setRepeatEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [nameError, setNameError] = useState('')
    const [emailError, setEmailError] = useState('')
    const [checkoutError, setCheckoutError] = useState('')
    const [processing, setProcessing] = useState(false)
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [termsExpanded, setTermsExpanded] = useState(false)
    const submittingRef = useRef(false)

    // Signature state
    const sigPadRef = useRef(null)
    const hasDrawnRef = useRef(false)
    const [signatureError, setSignatureError] = useState('')
    const [signatureTab, setSignatureTab] = useState('draw') // 'draw' | 'type'
    const [typedSignature, setTypedSignature] = useState('')
    const [sigModalOpen, setSigModalOpen] = useState(false)
    const [signatureAccepted, setSignatureAccepted] = useState(false)
    const [signatureDataUrl, setSignatureDataUrl] = useState(null)

    // Pre-fill form fields from a stored session
    useEffect(() => {
        const session = readCheckoutSession()
        if (!session) return
        const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null
        if (!expiresAt || expiresAt <= new Date() || session.eventId !== eventId) {
            clearCheckoutSession()
            return
        }
        if (session.name) setName(session.name)
        if (session.email) { setEmail(session.email); setRepeatEmail(session.email) }
        if (session.phone) setPhone(session.phone)
    }, [eventId])

    // Reset processing state when restoring from bfcache (Back from Stripe)
    useEffect(() => {
        const onPageShow = (e) => {
            if (!e.persisted) return
            setProcessing(false)
            submittingRef.current = false
        }
        window.addEventListener('pageshow', onPageShow)
        return () => window.removeEventListener('pageshow', onPageShow)
    }, [])

    useEffect(() => {
        if (!eventId || Object.keys(selectedTickets).length === 0) {
            navigate('/')
            return
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

    // Validate → call API → redirect to Stripe
    const handleCheckout = async (e) => {
        e.preventDefault()
        if (submittingRef.current || processing) return

        // Resume existing Stripe session if tickets unchanged and not expired
        const session = readCheckoutSession()
        if (session?.eventId === eventId && session.stripeUrl && session.ticketsParam === ticketsParam) {
            const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null
            if (expiresAt && expiresAt > new Date()) {
                window.location.href = session.stripeUrl
                return
            }
            clearCheckoutSession()
        }

        let hasError = false

        if (!name.trim() || name.trim().split(/\s+/).length < 2) {
            setNameError('Enter your full name — e.g. John Doe')
            hasError = true
        } else {
            setNameError('')
        }

        if (!email) {
            setEmailError('Please enter your email address.')
            hasError = true
        } else if (repeatEmail && email.toLowerCase() !== repeatEmail.toLowerCase()) {
            setEmailError('Email addresses do not match.')
            hasError = true
        } else {
            setEmailError('')
        }

        if (hasError) return

        const hasTerms = event?.terms?.has_terms

        if (hasTerms && !termsAccepted) {
            setCheckoutError('Please agree to the event waiver to continue.')
            return
        }
        setCheckoutError('')

        // Validate signature only if event has a waiver
        let termsSignature
        if (hasTerms) {
            if (!signatureAccepted || !signatureDataUrl) {
                setSignatureError('Please add your signature before proceeding.')
                return
            }
            setSignatureError('')
            termsSignature = signatureDataUrl
        }

        submittingRef.current = true
        setProcessing(true)

        try {
            const items = tickets.map(t => ({
                ticket_type_id: t.id,
                quantity: selectedTickets[t.id]
            }))

            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

            const { data } = await axios.post(API_ENDPOINTS.checkoutCreate(), {
                event_id: eventId,
                items,
                customer_email: email,
                customer_name: name,
                customer_phone: phone,
                customer_timezone: tz,
                ...(hasTerms && { terms_accepted: true, terms_signature: termsSignature }),
            })

            if (!data.url) throw new Error('No redirect URL received from server.')

            const expiresAt = new Date(Date.now() + CHECKOUT_SESSION_TTL_MS).toISOString()
            saveCheckoutSession({ eventId, ticketsParam, stripeUrl: data.url, name, email, phone, expiresAt })

            window.location.href = data.url
        } catch (err) {
            const detail = err.response?.data?.detail
            let errMsg = 'Failed to initiate checkout. Please try again.'
            if (typeof detail === 'string') {
                if (detail.includes('Ticket Tailor issuance failed')) {
                    let ttMessage = detail
                    try {
                        const jsonStrMatch = detail.match(/\{.*\}/)
                        if (jsonStrMatch) {
                            const parsed = JSON.parse(jsonStrMatch[0])
                            if (parsed.message) ttMessage = parsed.message
                        }
                    } catch {}
                    errMsg = `Organizer configuration issue: We could not issue your ticket. Please contact the event organizer. (${ttMessage})`
                } else {
                    errMsg = detail
                }
            } else if (Array.isArray(detail)) {
                errMsg = detail.map(d => `${d.loc?.[d.loc.length - 1] || 'Field'}: ${d.msg}`).join(', ')
            }
            setCheckoutError(errMsg)
            submittingRef.current = false
            setProcessing(false)
        }
    }

    if (loading) return <CheckoutSkeleton />

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

    const totalPrice = tickets.reduce((sum, t) => sum + ((t.price || 0) / 100 * selectedTickets[t.id]), 0)

    const formatTime12h = (timeStr) => {
        if (!timeStr) return ''
        const [h, m] = timeStr.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const hour = h % 12 || 12
        return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
    }

    const d = event.start?.date ? new Date(event.start.date) : null
    const dateStr = d ? d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null

    const termsHtml = event?.terms?.terms_html

    return (
        <div className="max-w-4xl mx-auto py-8 px-5 lg:px-8 animate-fade-up bg-app-bg">
            <button onClick={() => navigate(eventId ? `/events/${eventId}` : '/')} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-app-text-muted hover:text-app-text mb-6 transition-colors group">
                <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-1" /> Back
            </button>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-app-border pb-6">
                <h1 className="font-outfit text-2xl md:text-3xl font-bold text-app-text tracking-tight">Checkout</h1>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex-shrink-0">
                    <ShieldCheck size={14} className="text-emerald-500" /> Secure SSL
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

                {/* ─── Left Column: Form ─── */}
                <div className="lg:col-span-7 order-2 lg:order-1 min-w-0">
                    <div className="p-5 md:p-6 bg-app-surface border border-app-border shadow-organic rounded-[1.25rem] overflow-hidden">
                        <h2 className="font-outfit text-lg font-bold text-app-text mb-5 flex items-center gap-3">
                            <span className="w-5 h-5 rounded bg-brand-600/10 text-brand-600 flex items-center justify-center text-[10px] font-bold border border-brand-400/20">1</span>
                            Your Details
                        </h2>

                        <form onSubmit={handleCheckout}>
                            {checkoutError && (
                                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-start gap-2.5">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <p className="font-medium leading-relaxed">{checkoutError}</p>
                                </div>
                            )}

                            <div className="space-y-3.5 mb-6">
                                {/* Full Name */}
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
                                    {nameError && <p className="mt-1.5 text-[11px] text-red-500 font-medium">{nameError}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-app-text-muted mb-1.5">
                                        Email Address <span className="text-brand-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                                        placeholder="jane@example.com"
                                        className={`w-full px-3.5 py-2.5 rounded-lg bg-app-bg border text-app-text placeholder-app-text-faint focus:bg-app-surface focus:ring-2 transition-all font-medium text-[13px] ${emailError ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10' : 'border-app-border focus:border-brand-500 focus:ring-brand-500/10'}`}
                                    />
                                    <p className="text-[10px] font-medium text-app-text-faint mt-1.5 ml-1">Tickets will be sent here.</p>
                                </div>

                                {/* Repeat Email */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-app-text-muted mb-1.5">
                                        Repeat Email <span className="text-brand-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={repeatEmail}
                                        onChange={e => { setRepeatEmail(e.target.value); if (emailError) setEmailError('') }}
                                        placeholder="jane@example.com"
                                        className={`w-full px-3.5 py-2.5 rounded-lg bg-app-bg border text-app-text placeholder-app-text-faint focus:bg-app-surface focus:ring-2 transition-all font-medium text-[13px] ${emailError ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10' : 'border-app-border focus:border-brand-500 focus:ring-brand-500/10'}`}
                                    />
                                    {emailError && <p className="mt-1.5 text-[11px] text-red-500 font-medium">{emailError}</p>}
                                </div>

                                {/* Phone */}
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

                            {/* ── Event Waiver (Terms & Conditions) ─────────────── */}
                            {event?.terms?.has_terms && <div className="mb-6 pt-5 border-t border-app-border">
                                <h2 className="font-outfit text-sm font-bold text-app-text mb-4 flex items-center gap-3">
                                    <span className="w-5 h-5 rounded bg-brand-600/10 text-brand-600 flex items-center justify-center text-[10px] font-bold border border-brand-400/20">2</span>
                                    Event Waiver
                                </h2>

                                {/* Agree checkbox + view terms toggle */}
                                <div className="flex items-center gap-2.5 mb-3">
                                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                                        <div className="relative shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={termsAccepted}
                                                onChange={e => setTermsAccepted(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-4 h-4 rounded border-2 border-app-border bg-app-bg peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-colors flex items-center justify-center">
                                                {termsAccepted && (
                                                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[13px] font-semibold text-app-text">
                                            I agree to the event waiver <span className="text-brand-500">*</span>
                                        </span>
                                    </label>
                                    {termsHtml && (
                                        <button
                                            type="button"
                                            onClick={() => setTermsExpanded(p => !p)}
                                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors shrink-0"
                                        >
                                            {termsExpanded ? 'Hide' : 'View'}
                                            <ChevronDown size={12} className={`transition-transform ${termsExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    )}
                                </div>

                                {/* Scrollable terms text — hidden by default */}
                                {termsHtml && termsExpanded && (
                                    <div className="w-full max-w-full mb-3 rounded-lg border border-app-border bg-app-bg overflow-hidden">
                                        <div
                                            className="h-40 overflow-y-auto p-3.5 text-[12px] text-app-text-muted leading-relaxed break-all"
                                            dangerouslySetInnerHTML={{ __html: termsHtml }}
                                        />
                                    </div>
                                )}

                                {/* Signature button / accepted state */}
                                {signatureError && (
                                    <p className="text-[11px] text-red-500 font-medium mb-2">{signatureError}</p>
                                )}
                                {signatureAccepted ? (
                                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                        <div className="flex items-center gap-2 text-emerald-700">
                                            <Check size={14} />
                                            <span className="text-[13px] font-semibold">Signature added</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { hasDrawnRef.current = false; setSigModalOpen(true); setSignatureAccepted(false); setSignatureDataUrl(null) }}
                                            className="text-[12px] text-app-text-muted hover:text-app-text underline transition-colors"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => { hasDrawnRef.current = false; setSigModalOpen(true) }}
                                        className="flex items-center gap-2 rounded-full border border-brand-400 text-brand-600 px-5 py-2 text-[13px] font-semibold hover:bg-brand-50 transition-colors"
                                    >
                                        <PenLine size={14} /> Add your signature
                                    </button>
                                )}

                            </div>}

                            <div className="pt-5 border-t border-app-border">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full flex items-center justify-center gap-2 bg-app-text text-app-surface font-bold py-3 rounded-lg hover:bg-[#1A1817] transition-colors disabled:opacity-50 disabled:pointer-events-none text-[13px] shadow-organic"
                                >
                                    {processing ? (
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

                        {/* ── Signature Modal — outside the form so clicks never bubble to onSubmit ── */}
                        {event?.terms?.has_terms && sigModalOpen && createPortal(
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                                onKeyDown={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setSigModalOpen(false)} />
                                <div className="relative bg-app-surface border border-app-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
                                        <h3 className="text-base font-bold text-app-text">Signature</h3>
                                        <button type="button" onClick={() => setSigModalOpen(false)} className="p-1.5 rounded-lg hover:bg-app-surface-2 transition-colors text-app-text-muted">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        </button>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-1.5 px-6 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setSignatureTab('draw'); setSignatureError('') }}
                                            className={`flex-1 py-1.5 rounded-md text-[12px] font-semibold border transition-colors ${signatureTab === 'draw' ? 'border-app-text bg-app-text text-app-surface' : 'border-app-border text-app-text-muted bg-app-bg hover:bg-app-surface-2'}`}
                                        >
                                            Draw
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSignatureTab('type'); setSignatureError('') }}
                                            className={`flex-1 py-1.5 rounded-md text-[12px] font-semibold border transition-colors ${signatureTab === 'type' ? 'border-app-text bg-app-text text-app-surface' : 'border-app-border text-app-text-muted bg-app-bg hover:bg-app-surface-2'}`}
                                        >
                                            Type
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="px-6 pt-3 pb-5">
                                        {signatureTab === 'draw' ? (
                                            <>
                                                <p className="text-[12px] text-app-text-muted mb-1.5">Please sign below:</p>
                                                <div className="rounded-lg border border-app-border bg-white overflow-hidden">
                                                    <SignatureCanvas
                                                        ref={sigPadRef}
                                                        penColor="#1a1817"
                                                        canvasProps={{
                                                            width: 400,
                                                            height: 160,
                                                            style: { width: '100%', height: '160px', touchAction: 'none', display: 'block' }
                                                        }}
                                                        dotSize={1.5}
                                                        minWidth={1}
                                                        maxWidth={2.5}
                                                        velocityFilterWeight={0.7}
                                                        onBegin={() => setSignatureError('')}
                                                        onEnd={() => { hasDrawnRef.current = true }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-app-text-faint mt-1">Use your mouse or finger to sign</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-[12px] text-app-text-muted mb-1.5">Type your full name:</p>
                                                <input
                                                    type="text"
                                                    value={typedSignature}
                                                    onChange={e => setTypedSignature(e.target.value)}
                                                    placeholder="Your full name"
                                                    autoFocus
                                                    className="w-full rounded-lg border border-app-border bg-app-bg px-3.5 py-2.5 text-[13px] text-app-text placeholder:text-app-text-faint focus:outline-none focus:border-app-border"
                                                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                                />
                                                {typedSignature && (
                                                    <p
                                                        className="mt-3 text-center text-[22px] text-app-text border-b border-dashed border-app-border pb-2"
                                                        style={{ fontFamily: 'Dancing Script, Georgia, cursive' }}
                                                    >
                                                        {typedSignature}
                                                    </p>
                                                )}
                                            </>
                                        )}

                                        {/* Modal actions */}
                                        <div className="flex items-center gap-2.5 mt-4">
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    if (signatureTab === 'draw') { sigPadRef.current?.clear(); hasDrawnRef.current = false }
                                                    else setTypedSignature('')
                                                    setSignatureError('')
                                                }}
                                                className="flex-1 py-2 rounded-full border border-app-border text-[12px] font-semibold text-app-text-muted hover:bg-app-surface-2 transition-colors"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    if (signatureTab === 'draw') {
                                                        if (!sigPadRef.current || !hasDrawnRef.current) {
                                                            setSignatureError('Please draw your signature.')
                                                            return
                                                        }
                                                        setSignatureDataUrl(sigPadRef.current.toDataURL('image/png'))
                                                    } else {
                                                        if (!typedSignature.trim()) {
                                                            setSignatureError('Please type your name.')
                                                            return
                                                        }
                                                        const tc = document.createElement('canvas')
                                                        tc.width = 600; tc.height = 130
                                                        const ctx = tc.getContext('2d')
                                                        ctx.fillStyle = '#ffffff'
                                                        ctx.fillRect(0, 0, tc.width, tc.height)
                                                        ctx.fillStyle = '#1a1817'
                                                        ctx.font = 'italic 38px Georgia, "Times New Roman", serif'
                                                        ctx.textAlign = 'center'
                                                        ctx.textBaseline = 'middle'
                                                        ctx.fillText(typedSignature.trim(), tc.width / 2, tc.height / 2)
                                                        setSignatureDataUrl(tc.toDataURL('image/png'))
                                                    }
                                                    setSignatureError('')
                                                    setSignatureAccepted(true)
                                                    setSigModalOpen(false)
                                                }}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-app-text text-app-surface text-[12px] font-bold hover:opacity-90 transition-opacity"
                                            >
                                                <Check size={13} /> Accept
                                            </button>
                                        </div>
                                        {signatureError && (
                                            <p className="text-[11px] text-red-500 font-medium mt-2 text-center">{signatureError}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        , document.body)}
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
                                        <span>{formatTime12h(event.start.time)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-app-text-faint mb-4">Summary</h4>
                            <div className="space-y-3.5 mb-5">
                                {tickets.map(t => {
                                    const qty = selectedTickets[t.id]
                                    const price = (t.price || 0) / 100
                                    return (
                                        <div key={t.id} className="flex justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="font-outfit font-bold text-app-text text-[13px] mb-0.5">{t.name}</p>
                                                <p className="text-[10px] font-medium text-app-text-muted">${price.toFixed(2)} x {qty}</p>
                                            </div>
                                            <span className="font-outfit font-bold text-sm text-app-text">${(price * qty).toFixed(2)}</span>
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
    )
}
