export const CHECKOUT_SESSION_KEY = 'co_session'
export const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000

export function parseTimestampMs(value) {
    if (value == null) return null

    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
        const n = Number(value)
        if (!Number.isFinite(n)) return null
        return n < 1e12 ? n * 1000 : n
    }

    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
}

export function readCheckoutSession() {
    try {
        const raw = sessionStorage.getItem(CHECKOUT_SESSION_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
        return null
    }
}

export function clearCheckoutSession() {
    sessionStorage.removeItem(CHECKOUT_SESSION_KEY)
}

export function saveCheckoutSession(session) {
    sessionStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(session))
}

export function stampCheckoutSession(session, ttlMs = CHECKOUT_SESSION_TTL_MS) {
    const now = Date.now()
    return {
        ...session,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMs).toISOString(),
    }
}

export function parseTicketSelection(ticketsParam) {
    if (!ticketsParam) return {}

    try {
        const parsed = JSON.parse(ticketsParam)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

        return Object.entries(parsed).reduce((acc, [ticketTypeId, qty]) => {
            const n = Number(qty)
            if (Number.isFinite(n) && n > 0) {
                acc[ticketTypeId] = Math.floor(n)
            }
            return acc
        }, {})
    } catch {
        return {}
    }
}

export function getCheckoutSessionState({ eventId, ttlMs = CHECKOUT_SESSION_TTL_MS, nowMs = Date.now() } = {}) {
    const session = readCheckoutSession()
    if (!session) return { status: 'empty' }

    if (eventId && String(session.eventId) !== String(eventId)) {
        return { status: 'mismatch', session }
    }

    const expiryMs = parseTimestampMs(session.expiresAt)
    const createdMs = parseTimestampMs(session.createdAt)
    const effectiveExpiryMs = expiryMs ?? (createdMs ? createdMs + ttlMs : null)

    if (effectiveExpiryMs && effectiveExpiryMs <= nowMs) {
        return { status: 'expired', session }
    }

    if (!effectiveExpiryMs) {
        return { status: 'valid', normalized: true, session: stampCheckoutSession(session, ttlMs) }
    }

    return { status: 'valid', normalized: false, session }
}
