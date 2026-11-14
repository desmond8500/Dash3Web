import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@tabler/core/dist/css/tabler.min.css'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import '@tabler/core/dist/js/tabler.min.js'
import './styles.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
