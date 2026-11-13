import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setUnauthorizedHandler } from '@/api/client'

import AppLayout from '@/layouts/AppLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: AppLayout,
    meta: { auth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue') },
      { path: 'clients', name: 'clients', component: () => import('@/pages/ClientsPage.vue') },
      { path: 'projets', name: 'projets', component: () => import('@/pages/ProjetsPage.vue') },
      { path: 'taches', name: 'taches', component: () => import('@/pages/TasksPage.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.matched.some((r) => r.meta.auth)) {
    if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
    if (!auth.user) {
      try {
        await auth.fetchMe()
      } catch {
        auth.clear()
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    }
  }

  if (to.meta.guest && auth.isAuthenticated) return { name: 'dashboard' }
})

setUnauthorizedHandler(() => {
  useAuthStore().clear()
  if (router.currentRoute.value.name !== 'login') {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  }
})

export default router
