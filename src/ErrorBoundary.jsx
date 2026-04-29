import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
    state = { hasError: false }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info.componentStack)
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-app-bg">
                <div className="max-w-sm w-full text-center">
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100">
                        <AlertTriangle size={28} className="text-red-500" />
                    </div>
                    <h1 className="font-outfit text-xl font-bold text-app-text mb-2">Something went wrong</h1>
                    <p className="text-app-text-muted text-[13px] mb-6 leading-relaxed">
                        An unexpected error occurred. Please refresh the page or go back to the homepage.
                    </p>
                    <div className="flex flex-col gap-2.5">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-app-text text-app-surface font-bold py-3 rounded-lg text-[13px] hover:bg-[#1A1817] transition-colors shadow-sm"
                        >
                            Refresh Page
                        </button>
                        <button
                            onClick={() => { window.location.href = '/' }}
                            className="w-full bg-app-surface text-app-text font-bold py-3 rounded-lg text-[13px] border border-app-border hover:bg-app-surface-2 transition-colors"
                        >
                            Back to Homepage
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}
