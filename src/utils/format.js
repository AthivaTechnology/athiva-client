// Shared formatting utilities used across pages

export const formatDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return {
        day:   d.toLocaleDateString('en-GB', { day: 'numeric' }),
        month: d.toLocaleDateString('en-GB', { month: 'short' }),
        full:  d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    }
}

export const getStatusStyle = (status) => {
    switch (status) {
        case 'on_sale':
        case 'published':
            return { label: 'On Sale',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
        case 'processing':
            return { label: 'Processing', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
        case 'draft':
            return { label: 'Draft',      cls: 'bg-amber-100 text-amber-700 border-amber-200' }
        case 'off_sale':
            return { label: 'Off Sale',   cls: 'bg-gray-100 text-gray-500 border-gray-200' }
        case 'cancelled':
            return { label: 'Cancelled',  cls: 'bg-red-100 text-red-600 border-red-200' }
        case 'past':
        case 'completed':
            return { label: 'Past',       cls: 'bg-gray-100 text-gray-400 border-gray-200' }
        default:
            return { label: status,       cls: 'bg-app-surface/80 text-app-text-muted border-app-border' }
    }
}

export const getLowestPrice = (ticketTypes) => {
    if (!ticketTypes?.length) return null
    const prices = ticketTypes.map(t => t.price || 0).filter(p => p >= 0)
    const min = Math.min(...prices)
    return min === 0 ? 'Free' : `$${(min / 100).toFixed(2)}`
}
