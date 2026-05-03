import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, AlertCircle, Mail, CalendarDays, ArrowRight } from 'lucide-react'
import axios from 'axios'
import { API_ENDPOINTS } from '../config/api'

export default function CheckoutSuccessPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const sessionId = searchParams.get('session_id')

    const [status, setStatus] = useState('loading') // loading | success | failed | error | pending_timeout | refunded
    const [sessionData, setSessionData] = useState(null)

    useEffect(() => {
        if (!sessionId) {
            navigate('/')
            return
        }

        let attempts = 0
        const maxAttempts = 10
        let cancelled = false
        let lastKnownStatus = 'pending'

        async function pollSession() {
            if (cancelled) return
            try {
                const { data } = await axios.get(API_ENDPOINTS.checkoutSession(sessionId))
                if (cancelled) return

                lastKnownStatus = data.status

                if (data.status === 'complete') {
                    setSessionData(data)
                    setStatus('success')
                    document.title = 'Booking Confirmed'
                } else if (data.status === 'refunded') {
                    setSessionData(data)
                    setStatus('refunded')
                } else if (data.status === 'failed') {
                    setSessionData(data)
                    setStatus('failed')
                } else if (data.status === 'expired') {
                    // Hold released by frontend timer — webhook is processing the refund.
                    // Keep polling; if it completes the status will flip to 'refunded'.
                    if (attempts < maxAttempts) {
                        attempts++
                        setTimeout(pollSession, 3000)
                    } else {
                        setSessionData(data)
                        setStatus('pending_timeout')
                    }
                } else if (attempts < maxAttempts) {
                    attempts++
                    setTimeout(pollSession, 3000)
                } else {
                    // Exhausted all attempts — if backend was already recovering,
                    // show amber "still confirming" instead of red "payment failed"
                    setSessionData(data)
                    const timedOutGracefully = ['pending_recovery', 'processing'].includes(lastKnownStatus)
                    setStatus(timedOutGracefully ? 'pending_timeout' : 'failed')
                }
            } catch (err) {
                if (cancelled) return
                if (attempts < maxAttempts) {
                    attempts++
                    setTimeout(pollSession, 3000)
                } else {
                    setStatus('error')
                }
            }
        }

        pollSession()
        return () => { cancelled = true }
    }, [sessionId, navigate])

    const shortOrderId = sessionId ? sessionId.split('_').slice(-1)[0].slice(0, 12).toUpperCase() : ''

    return (
        <div className="flex-1 flex items-center justify-center p-5 py-12 min-h-[70vh] bg-app-bg">

            {status === 'loading' && (
                <div className="text-center animate-fade-up flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 border-app-surface-2 border-t-brand-500 animate-spin mb-5" />
                    <p className="font-outfit text-lg font-bold text-app-text mb-1">
                        Confirming your order...
                    </p>
                    <p className="text-[13px] text-app-text-muted">
                        Please wait a moment.
                    </p>
                </div>
            )}

            {status === 'error' && (
                <div className="w-full max-w-sm animate-fade-up">
                    <div className="rounded-[1.25rem] shadow-organic overflow-hidden border border-amber-100 bg-app-surface">
                        <div className="bg-amber-50 p-6 text-center border-b border-amber-100 relative overflow-hidden">
                            <AlertCircle size={40} className="text-amber-500 mx-auto mb-3 relative z-10" />
                            <h2 className="font-outfit text-xl font-bold text-app-text relative z-10">Unable to Confirm</h2>
                        </div>
                        <div className="p-6 text-center space-y-6">
                            <p className="text-app-text-muted text-[13px] leading-relaxed">
                                We could not reach our server to confirm your booking.
                                If payment was taken, your tickets will be emailed shortly.
                            </p>
                            <Link to="/" className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold bg-app-surface text-app-text border border-app-border hover:bg-app-surface-2 transition-colors shadow-sm text-[13px]">
                                Return to Events <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {status === 'pending_timeout' && (
                <div className="w-full max-w-sm animate-fade-up">
                    <div className="rounded-[1.25rem] shadow-organic overflow-hidden border border-amber-100 bg-app-surface">
                        <div className="bg-amber-50 p-6 text-center border-b border-amber-100 relative overflow-hidden">
                            <AlertCircle size={40} className="text-amber-500 mx-auto mb-3 relative z-10" />
                            <h2 className="font-outfit text-xl font-bold text-app-text relative z-10">Still Confirming</h2>
                        </div>
                        <div className="p-6 text-center space-y-6">
                            <p className="text-app-text-muted text-[13px] leading-relaxed">
                                Your payment was received and your tickets are being processed.
                                Check your email in a few minutes — your tickets will arrive shortly.
                            </p>
                            <Link to="/" className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold bg-app-surface text-app-text border border-app-border hover:bg-app-surface-2 transition-colors shadow-sm text-[13px]">
                                Return to Events <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {status === 'failed' && (
                <div className="w-full max-w-sm animate-fade-up">
                    <div className="rounded-[1.25rem] shadow-organic overflow-hidden border border-red-100 bg-app-surface">
                        <div className="bg-red-50 p-6 text-center border-b border-red-100 relative overflow-hidden">
                            <XCircle size={40} className="text-red-500 mx-auto mb-3 relative z-10" />
                            <h2 className="font-outfit text-xl font-bold text-app-text relative z-10">Payment Failed</h2>
                        </div>
                        <div className="p-6 text-center space-y-6">
                            <p className="text-app-text-muted text-[13px] leading-relaxed">
                                We were unable to verify your payment.
                                If funds were deducted, please contact our support team.
                            </p>
                            <Link to="/" className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold bg-app-surface text-app-text border border-app-border hover:bg-app-surface-2 transition-colors shadow-sm text-[13px]">
                                Return to Events <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {status === 'refunded' && (
                <div className="w-full max-w-sm animate-fade-up">
                    <div className="rounded-[1.25rem] shadow-organic overflow-hidden border border-red-100 bg-app-surface">
                        <div className="bg-red-50 p-6 text-center border-b border-red-100 relative overflow-hidden">
                            <XCircle size={40} className="text-red-500 mx-auto mb-3 relative z-10" />
                            <h2 className="font-outfit text-xl font-bold text-app-text relative z-10">Payment Refunded</h2>
                        </div>
                        <div className="p-6 text-center space-y-4">
                            <p className="text-app-text-muted text-[13px] leading-relaxed">
                                Your ticket reservation expired while you were completing payment.
                                A full refund has been issued and will appear on your card in 3–10 business days.
                            </p>
                            <p className="text-app-text-muted text-[13px] leading-relaxed">
                                Check your email for a refund confirmation, then try booking again if tickets are still available.
                            </p>
                            <Link to="/" className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold bg-app-surface text-app-text border border-app-border hover:bg-app-surface-2 transition-colors shadow-sm text-[13px]">
                                Back to Events <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {status === 'success' && (
                <div className="w-full max-w-sm animate-fade-up">
                    <div className="rounded-[1.25rem] shadow-organic overflow-hidden border border-app-border bg-app-surface">

                        {/* Header */}
                        <div className="bg-emerald-50/50 p-6 text-center relative overflow-hidden border-b border-app-border">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
                            <CheckCircle size={40} className="text-brand-500 mx-auto mb-3 relative z-10" />
                            <h2 className="font-outfit text-xl font-bold text-app-text relative z-10">Booking Confirmed</h2>
                        </div>

                        {/* Body */}
                        <div className="px-5 py-6 space-y-5">
                            {/* Ticket Tailor Issue Alert */}
                            {sessionData?.tt_error && (
                                <div className="rounded-lg p-3.5 border border-amber-200 bg-amber-50 flex items-start gap-2.5">
                                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-outfit font-bold text-amber-900 text-[13px] mb-1">Ticket Delivery Delayed</p>
                                        <p className="text-[11px] text-amber-700 leading-relaxed">
                                            Payment successful, but generating barcodes is delayed.
                                        </p>
                                        {sessionData.tt_error.includes("billing details") && (
                                            <p className="text-[10px] text-amber-800 p-2 bg-amber-100/50 rounded flex mt-2">
                                                Note: Organizer notified to resolve billing. Tickets will arrive via email soon.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* What's next */}
                            <div className="space-y-3.5">
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-app-text-faint mb-3">Important Next Steps</p>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center text-brand-500 mt-0.5 bg-brand-500/10">
                                        <Mail size={12} />
                                    </div>
                                    <div>
                                        <p className="font-outfit font-bold text-[13px] text-app-text mb-0.5">Check your inbox</p>
                                        <p className="text-[11px] text-app-text-muted leading-relaxed">
                                            A confirmation email with your ticket barcode has been sent.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center text-brand-500 mt-0.5 bg-brand-500/10">
                                        <CalendarDays size={12} />
                                    </div>
                                    <div>
                                        <p className="font-outfit font-bold text-[13px] text-app-text mb-0.5">Present your ticket</p>
                                        <p className="text-[11px] text-app-text-muted leading-relaxed">
                                            Show your barcode at the entrance on the event day.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            <div className="pt-5 border-t border-app-border">
                                <Link to="/" className="flex items-center justify-center gap-2 w-full rounded-lg py-3 font-bold text-app-surface bg-app-text hover:bg-[#1A1817] transition-colors shadow-sm text-[13px]">
                                    Browse More <ArrowRight size={14} />
                                </Link>
                                <p className="text-center text-[10px] text-app-text-faint mt-4">
                                    Need help? <a href="mailto:support@athiva.com" className="text-brand-600 hover:text-brand-500 font-medium">Contact support</a>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
