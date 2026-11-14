// KERN first, so that the app styles can build on and override it.
import '@kern-ux/native/dist/kern.min.css'

import './styles/fonts.css'
import './styles/main.css'
import { createApp } from 'vue'

import App from './App.vue'

createApp(App).mount('#app')
