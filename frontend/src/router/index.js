import { createRouter, createWebHistory } from 'vue-router'
import CheckerView from '../views/CheckerView.vue'
import HistoryView from '../views/HistoryView.vue'
import ContinueView from '../views/ContinueView.vue'
import WriterView from '../views/WriterView.vue'
import BatchView from '../views/BatchView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'checker',
      component: CheckerView
    },
    {
      path: '/continue',
      name: 'continue',
      component: ContinueView
    },
    {
      path: '/writer',
      name: 'writer',
      component: WriterView
    },
    {
      path: '/batch',
      name: 'batch',
      component: BatchView
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView
    }
  ]
})

export default router
