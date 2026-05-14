import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { readCheckoutSession } from '../utils/checkoutSession'

export default function CheckoutCancelPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const urlEventId = searchParams.get('event_id')
    const [redirectIn, setRedirectIn] = useState(3)
    const redirectRef = useRef(null)

    useEffect(() => {
        // If a valid session exists, resume checkout instead of showing cancelled screen
        const session = readCheckoutSession()
        if (session?.eventId === urlEventId && session.ticketsParam) {
            const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null
            if (expiresAt && expiresAt > new Date()) {
                navigate(
                    `/checkout?eventId=${session.eventId}&tickets=${encodeURIComponent(session.ticketsParam)}`,
                    { replace: true }
                )
                return
            }
        }

        document.title = 'Checkout Cancelled'

        setRedirectIn(3)
        redirectRef.current = setInterval(() => {
            setRedirectIn(prev => {
                if (prev <= 1) {
                    clearInterval(redirectRef.current)
                    navigate(urlEventId ? `/events/${urlEventId}` : '/')
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => {
            clearInterval(redirectRef.current)
            document.title = 'Events'
        }
    }, [navigate, urlEventId])

    return (
        <div className="flex-1 flex items-center justify-center p-5 py-12 min-h-[70vh] bg-app-bg animate-fade-up">
            <div className="max-w-sm w-full">
                <div className="p-6 text-center bg-app-surface border border-app-border rounded-[1.25rem] shadow-organic">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-5 border border-red-100">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <h1 className="font-outfit text-xl font-bold text-app-text mb-2">Checkout Cancelled</h1>
                    <p className="text-app-text-muted text-[13px] mb-6 leading-relaxed">
                        Your checkout was cancelled. Redirecting in{' '}
                        <strong className="text-app-text">{redirectIn}s</strong>...
                    </p>
                    <Link
                        to={urlEventId ? `/events/${urlEventId}` : '/'}
                        className="w-full flex items-center justify-center gap-2 bg-app-surface text-app-text font-bold py-3 rounded-lg hover:bg-app-surface-2 transition-colors border border-app-border text-[13px] shadow-sm"
                    >
                        <ArrowLeft size={14} /> {urlEventId ? 'Back to Event' : 'Back to Directory'}
                    </Link>
                </div>
            </div>
        </div>
    )
}

