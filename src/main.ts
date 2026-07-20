import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
import VxeUITable from 'vxe-table'
import 'vxe-table/lib/style.css'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

import App from './App.vue'
import router from './router'
import './styles/index.scss'

NProgress.configure({ showSpinner: false })

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Vant)
app.use(VxeUITable)
app.mount('#app')
