/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
            colors: {
                primary: { DEFAULT: '#6366f1', hover: '#4f46e5' },
                surface: { DEFAULT: '#0d0d1a', card: '#12122a', border: 'rgba(255,255,255,0.07)' },
            },
            animation: {
                'new-lead': 'newLead 2s ease-out forwards',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                newLead: {
                    '0%': { backgroundColor: 'rgba(16,185,129,0.25)', transform: 'translateX(-6px)' },
                    '60%': { backgroundColor: 'rgba(16,185,129,0.08)' },
                    '100%': { backgroundColor: 'transparent', transform: 'translateX(0)' },
                },
                fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
            },
        },
    },
    plugins: [],
};
