/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#007AFF',
          dark: '#0062CC',
          light: '#E8F1FF'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      borderRadius: {
        lg: '12px'
      }
    }
  },
  plugins: []
}
