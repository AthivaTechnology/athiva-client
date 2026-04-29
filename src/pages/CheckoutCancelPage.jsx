import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import axios from 'axios'
import { API_ENDPOINTS } from '../config/api'

export default function CheckoutCancelPage() {
    const [searchParams] = useSearchParams()
    const eventId = searchParams.get('event_id')

    // Release the TT hold immediately when user cancels at Stripe
    useEffect(() => {
        document.title = 'Checkout Cancelled'
        const raw = sessionStorage.getItem('tt_hold')
        if (!raw) return
        try {
            const hold = JSON.parse(raw)
            if (hold.sessionId) {
                axios.post(API_ENDPOINTS.releaseHold(hold.sessionId)).catch(() => {})
            }
        } catch (_) {}
        sessionStorage.removeItem('tt_hold')
        return () => { document.title = 'Events' }
    }, [])

    return (
        <div className="flex-1 flex items-center justify-center p-5 py-12 min-h-[70vh] bg-app-bg animate-fade-up">
            <div className="max-w-sm w-full p-6 text-center bg-app-surface border border-app-border rounded-[1.25rem] shadow-organic">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-5 border border-red-100">
                    <AlertTriangle size={24} className="text-red-500" />
                </div>

                <h1 className="font-outfit text-xl font-bold text-app-text mb-2">Checkout Cancelled</h1>

                <p className="text-app-text-muted text-[13px] mb-6 leading-relaxed">
                    You have cancelled the payment process. If you experienced any issues or changed your mind, you can try again below.
                </p>

                <div className="flex flex-col gap-2.5">
                    {eventId && (
                        <Link to={`/events/${eventId}`} className="w-full flex items-center justify-center gap-2 bg-app-text text-app-surface font-bold py-3 rounded-lg hover:bg-[#1A1817] transition-colors shadow-sm text-[13px]">
                            Return to Event
                        </Link>
                    )}
                    <Link to="/" className="w-full flex items-center justify-center gap-2 bg-app-surface text-app-text font-bold py-3 rounded-lg hover:bg-app-surface-2 transition-colors border border-app-border text-[13px] shadow-sm">
                        <ArrowLeft size={14} /> Back to Directory
                    </Link>
                </div>
            </div>
        </div>
    )
}
