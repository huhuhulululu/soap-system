import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'checker',
      component: () => import('../views/CheckerView.vue')
    },
    {
      path: '/continue',
      name: 'continue',
      component: () => import('../views/ContinueView.vue')
    },
    {
      path: '/writer',
      name: 'writer',
      component: () => import('../views/WriterView.vue')
    },
    {
      path: '/batch',
      name: 'batch',
      component: () => import('../views/BatchView.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue')
    }
  ]
})

export default router
