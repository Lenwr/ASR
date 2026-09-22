import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// CSS global de l'application
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')