import { createApp } from 'vue'
import App from './App.vue'
import '@/styles/theme.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/Configurator/sw.js')
      .catch(err => console.error('SW registration failed:', err));
  });
}

createApp(App).mount('#app')
