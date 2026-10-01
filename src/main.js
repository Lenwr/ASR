import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// CSS global de l'application
import './style.css'
import 'vue3-toastify/dist/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Le service worker est actif uniquement en production, comme recommandé par Vite.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Le mode hors-ligne n’a pas pu être activé.', error)
    })
  })
}
