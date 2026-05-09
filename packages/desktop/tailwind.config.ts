import type { Config } from 'tailwindcss';

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                main: 'hsl(var(--main))',
                'main-foreground': 'hsl(var(--main-foreground))',
                bg: 'hsl(var(--bg))',
                fg: 'hsl(var(--fg))',
                border: 'hsl(var(--border))',
            },
            borderWidth: { '3': '3px', '5': '5px' },
            boxShadow: {
                neo: '4px 4px 0 0 hsl(var(--border))',
                'neo-lg': '6px 6px 0 0 hsl(var(--border))',
            },
            fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
        },
    },
    plugins: [],
} satisfies Config;
