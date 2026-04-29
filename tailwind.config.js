/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                outfit: ['Outfit', 'system-ui', 'sans-serif'],
            },
            colors: {
                brand: {
                    400: 'rgb(var(--brand-400) / <alpha-value>)',
                    500: 'rgb(var(--brand-500) / <alpha-value>)',
                    600: 'rgb(var(--brand-600) / <alpha-value>)',
                },
                app: {
                    surface: 'var(--app-surface)',
                    'surface-2': 'var(--app-surface-2)',
                    border: 'var(--app-border)',
                    text: 'var(--app-text)',
                    'text-muted': 'var(--app-text-muted)',
                    'text-faint': 'var(--app-text-faint)',
                },
                accent: {
                    fern: 'var(--accent-fern)',
                    marigold: 'var(--accent-marigold)',
                    terracotta: 'var(--accent-terracotta)',
                }
            },
            boxShadow: {
                'organic': '0 4px 24px -4px rgba(44, 42, 41, 0.04)',
                'organic-hover': '0 12px 32px -4px rgba(44, 42, 41, 0.08)',
            },
            keyframes: {
                shimmer: {
                    '100%': { transform: 'translateX(100%)' },
                }
            }
        },
    },
    plugins: [],
}
