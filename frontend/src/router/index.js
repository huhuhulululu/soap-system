import { createRouter, createWebHistory } from 'vue-router'

let authChecked = false
let isAuthenticated = false

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'checker',
      component: () => import('../views/CheckerView.vue')
    },
    {
      path: '/composer',
      name: 'composer',
      component: () => import('../views/ComposerView.vue')
    },
    { path: '/writer', redirect: '/composer' },
    { path: '/continue', redirect: '/composer?mode=continue' },
    {
      path: '/batch',
      name: 'batch',
      component: () => import('../views/BatchView.vue')
    },
    { path: '/history', redirect: '/' }
  ]
})

router.beforeEach(async (to, from, next) => {
  if (!authChecked) {
    try {
      const res = await fetch('/ac/api/auth/me', { credentials: 'include' })
      const data = await res.json()
      isAuthenticated = data.authenticated === true
    } catch {
      isAuthenticated = false
    }
    authChecked = true
  }

  if (!isAuthenticated) {
    window.location.href = '/portal/'
    return
  }

  next()
})

export default router
