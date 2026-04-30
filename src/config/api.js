// Centralized API configuration
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1'

export const API_ENDPOINTS = {
    checkoutSession: (sessionId) => `${API_BASE}/site/checkout/session/${sessionId}`,
    releaseHold: (sessionId) => `${API_BASE}/site/checkout/session/${sessionId}/release-hold`,
    events: () => `${API_BASE}/site/events`,
    event: (eventId) => `${API_BASE}/site/events/${eventId}`,
    checkoutCreate: () => `${API_BASE}/site/checkout/session`,
    bookings: (email) => `${API_BASE}/site/bookings?email=${encodeURIComponent(email)}`,
}
