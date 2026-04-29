# Athiva — Public Event Booking Frontend

The customer-facing React application for the Talenta ticketing platform. Attendees browse events, purchase tickets via Stripe, and view their bookings — all scoped to the organiser's domain automatically.

## Tech Stack

- **React 19** with React Router v7
- **Vite 7** — dev server and production bundler
- **Tailwind CSS 3** — utility-first styling
- **Axios** — API communication
- **Lucide React** — icons

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | `HomePage` | Lists all upcoming events for the current organiser |
| `/events/:eventId` | `EventDetailPage` | Event details, ticket types, quantity selector, waitlist |
| `/checkout` | `CheckoutPage` | Customer details form + Stripe redirect |
| `/checkout/success` | `CheckoutSuccessPage` | Polls for booking confirmation after Stripe payment |
| `/checkout/cancel` | `CheckoutCancelPage` | Shown when user cancels on Stripe |
| `/bookings` | `MyBookingsPage` | Lookup bookings by email address |

## Key Features

- **Multi-tenant**: The organiser is identified from the request domain via `X-Client-ID` header — no hardcoded tenant config needed
- **Live inventory**: Ticket availability updates in real time, accounting for active holds and sold tickets
- **10-minute hold**: Inventory is reserved when checkout starts; released automatically if payment isn't completed
- **Waitlist**: Customers can join a waitlist when a ticket type is sold out
- **Free checkout**: Free tickets bypass Stripe and are issued immediately
- **Booking lookup**: Customers can retrieve their tickets by email on `/bookings`

## Project Structure

```
src/
├── config/
│   └── api.js              # Centralised API endpoint definitions
├── pages/
│   ├── HomePage.jsx
│   ├── EventDetailPage.jsx
│   ├── CheckoutPage.jsx
│   ├── CheckoutSuccessPage.jsx
│   ├── CheckoutCancelPage.jsx
│   └── MyBookingsPage.jsx
├── App.jsx                 # Router, Navbar, Footer
├── main.jsx                # Entry point
└── ErrorBoundary.jsx       # Top-level error fallback
```

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_BASE=https://your-backend-url/api/v1
```

Defaults to `http://localhost:8000/api/v1` when not set.

## Development Setup

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## API Endpoints Used

All requests go through `src/config/api.js`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/site/events` | GET | List upcoming events (identifies organiser from domain) |
| `/site/events/:id` | GET | Event details with live ticket availability |
| `/site/checkout/session` | POST | Create Stripe checkout session or free checkout |
| `/site/checkout/session/:id` | GET | Poll for payment/issuance status |
| `/site/checkout/session/:id/release-hold` | POST | Release TT hold when 10-min timer expires |
| `/site/bookings?email=` | GET | Retrieve customer bookings by email |
| `/site/waitlist/:eventId` | POST | Join waitlist for a sold-out ticket type |

## Checkout Flow

1. Customer selects tickets on `EventDetailPage`
2. Navigates to `CheckoutPage`, enters full name (first + last required), email, phone
3. Backend creates a TT inventory hold + Stripe session → redirects to Stripe
4. On successful payment → `CheckoutSuccessPage` polls `/checkout/session/:id` until tickets are issued
5. Confirmation email with barcodes sent by backend

## Validation Rules

- **Full name**: first and last name required (e.g. John Doe) — single-word names are rejected by TicketTailor
- **Email**: required, validated format
- **Phone**: optional
