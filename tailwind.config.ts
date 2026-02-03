import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      animation: {
        glitch: 'glitch 1s linear infinite',
        scan: 'scan 4s linear infinite',
      },
      keyframes: {
        glitch: {
          '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
          '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
          '62%': { transform: 'translate(0,0) skew(5deg)' },
        },
        scan: {
          '0%': { backgroundPosition: '0 -100vh' },
          '100%': { backgroundPosition: '0 100vh' },
        },
      },
    },
  },
}

export default config
