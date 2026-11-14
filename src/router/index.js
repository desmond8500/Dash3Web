import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setUnauthorizedHandler } from '@/api/client'

import AppLayout from '@/layouts/AppLayout.vue'

const ComingSoon = () => import('@/pages/ComingSoonPage.vue')

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

      // ERP
      { path: 'clients', name: 'clients', component: () => import('@/pages/ClientsPage.vue'), meta: { breadcrumbs: [{ name: 'ERP' }, { name: 'Clients' }] } },
      {
        path: 'projets',
        name: 'projets',
        component: () => import('@/pages/ProjetsPage.vue'),
        meta: { section: 'clients', breadcrumbs: [{ name: 'ERP' }, { name: 'Clients', to: { name: 'clients' } }, { name: 'Projets' }] },
      },
      {
        path: 'projets/:id',
        name: 'projet',
        component: () => import('@/pages/ProjetPage.vue'),
        meta: { section: 'clients' },
      },
      {
        path: 'projets/:id/batiments/:buildingId',
        name: 'batiment',
        component: () => import('@/pages/BuildingPage.vue'),
        meta: { section: 'clients' },
      },
      {
        path: 'projets/:id/plans/:planId',
        name: 'plan',
        component: () => import('@/pages/PlanEditorPage.vue'),
        meta: { section: 'clients' },
      },
      { path: 'devis', name: 'devis-list', component: () => import('@/pages/DevisListPage.vue'), meta: { breadcrumbs: [{ name: 'ERP' }, { name: 'Devis' }] } },
      { path: 'devis/:id', name: 'devis', component: () => import('@/pages/DevisPage.vue'), meta: { section: 'devis-list' } },
      { path: 'taches', name: 'taches', component: () => import('@/pages/TasksPage.vue'), meta: { breadcrumbs: [{ name: 'ERP' }, { name: 'Tâches' }] } },
      { path: 'documents', name: 'documents', component: ComingSoon, meta: { title: 'Documents', icon: 'ti-file', breadcrumbs: [{ name: 'ERP' }, { name: 'Documents' }] } },
      { path: 'equipe', name: 'equipe', component: ComingSoon, meta: { title: 'Équipe', icon: 'ti-users-group', breadcrumbs: [{ name: 'ERP' }, { name: 'Équipe' }] } },

      // Stock
      { path: 'stock/articles', name: 'articles', component: () => import('@/pages/stock/ArticlesPage.vue'), meta: { breadcrumbs: [{ name: 'Stock' }, { name: 'Articles' }] } },
      { path: 'stock/articles/:id', name: 'article', component: () => import('@/pages/stock/ArticlePage.vue'), meta: { section: 'articles' } },
      { path: 'stock/achats', name: 'achats', component: () => import('@/pages/stock/AchatsPage.vue'), meta: { breadcrumbs: [{ name: 'Stock' }, { name: 'Achats' }] } },
      { path: 'stock/icones', name: 'icones', component: () => import('@/pages/stock/IconsPage.vue'), meta: { breadcrumbs: [{ name: 'Stock' }, { name: 'Icônes' }] } },
      { path: 'stock/marques', name: 'marques', component: () => import('@/pages/stock/BrandsPage.vue'), meta: { breadcrumbs: [{ name: 'Stock' }, { name: 'Marques' }] } },
      { path: 'stock/fournisseurs', name: 'fournisseurs', component: () => import('@/pages/stock/ProvidersPage.vue'), meta: { breadcrumbs: [{ name: 'Stock' }, { name: 'Fournisseurs' }] } },

      // Comptabilité
      { path: 'comptabilite/bilan', name: 'bilan', component: () => import('@/pages/compta/BilanPage.vue'), meta: { breadcrumbs: [{ name: 'Comptabilité' }, { name: 'Bilan mensuel' }] } },

      // Paramètres
      { path: 'profil', name: 'profil', component: () => import('@/pages/settings/ProfilePage.vue'), meta: { breadcrumbs: [{ name: 'Paramètres' }, { name: 'Profil' }] } },
      { path: 'cvs', name: 'cvs', component: ComingSoon, meta: { title: 'Mes CVs', icon: 'ti-file-cv', breadcrumbs: [{ name: 'Paramètres' }, { name: 'Mes CVs' }] } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
  // Nouvelle page : on repart du haut
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
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
