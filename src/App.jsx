import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ticket } from 'lucide-react'
import HomePage from './pages/HomePage'
import EventDetailPage from './pages/EventDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage'
import CheckoutCancelPage from './pages/CheckoutCancelPage'
import MyBookingsPage from './pages/MyBookingsPage'
import { API_ENDPOINTS } from './config/api'

function Navbar() {
  const [clientName, setClientName] = useState('')
  const location = useLocation()

  useEffect(() => {
    axios.get(API_ENDPOINTS.events())
      .then(({ data }) => {
        if (data.client_name) setClientName(data.client_name)
      })
      .catch(() => { })
  }, [])

  return (
    <nav className="navbar">
      <div className="max-w-4xl mx-auto px-5 py-2.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-brand-600 text-white shadow-sm shadow-brand-600/20 transition-transform group-hover:scale-105">
            <Ticket size={14} />
          </div>
          <span className="font-outfit font-bold text-[15px] tracking-tight text-app-text transition-colors group-hover:text-brand-600 px-1">
            {clientName || '\u00A0'}
          </span>
        </Link>

        <div className="flex items-center gap-5 text-[13px] font-semibold">
          <Link
            to="/"
            className={`transition-colors duration-200 ${location.pathname === '/' ? 'text-brand-600' : 'text-app-text-muted hover:text-app-text'}`}
          >
            Events
          </Link>
          <Link
            to="/bookings"
            className={`transition-colors duration-200 ${location.pathname === '/bookings' ? 'text-brand-600' : 'text-app-text-muted hover:text-app-text'}`}
          >
            My Bookings
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="py-6 px-5 mt-auto border-t border-app-border bg-app-bg">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 group cursor-default">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-app-surface-2 text-app-text-faint group-hover:bg-brand-600/5 group-hover:text-brand-500 transition-colors">
            <Ticket size={10} />
          </div>
          <span className="text-[11px] font-medium text-app-text-muted tracking-wide">Powered by Talenta</span>
        </div>
        <p className="text-[11px] text-app-text-muted font-medium">
          &copy; {new Date().getFullYear()} All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
