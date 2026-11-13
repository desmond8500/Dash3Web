<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const menu = [
  { name: 'dashboard', label: 'Tableau de bord', icon: 'ti-home' },
  { name: 'clients', label: 'Clients', icon: 'ti-users' },
  { name: 'projets', label: 'Projets', icon: 'ti-briefcase' },
  { name: 'taches', label: 'Tâches', icon: 'ti-checklist' },
]

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="page">
    <header class="navbar navbar-expand-md d-print-none">
      <div class="container-xl">
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbar-menu"
          aria-controls="navbar-menu"
          aria-expanded="false"
          aria-label="Ouvrir le menu"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <RouterLink :to="{ name: 'dashboard' }" class="navbar-brand navbar-brand-autodark pe-0 pe-md-3">
          <span class="fw-bold">Dash3</span>
        </RouterLink>

        <div class="navbar-nav flex-row order-md-last">
          <div class="nav-item dropdown">
            <a href="#" class="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Menu utilisateur">
              <span class="avatar avatar-sm" :style="auth.user?.avatar ? { backgroundImage: `url(${auth.user.avatar})` } : null">
                <i v-if="!auth.user?.avatar" class="ti ti-user"></i>
              </span>
              <div class="d-none d-xl-block ps-2">
                <div>{{ auth.displayName }}</div>
                <div class="mt-1 small text-secondary">{{ auth.user?.function }}</div>
              </div>
            </a>
            <div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
              <a href="#" class="dropdown-item" @click.prevent="logout">
                <i class="ti ti-logout me-2"></i>Déconnexion
              </a>
            </div>
          </div>
        </div>

        <div class="collapse navbar-collapse" id="navbar-menu">
          <ul class="navbar-nav">
            <li v-for="item in menu" :key="item.name" class="nav-item">
              <RouterLink
                :to="{ name: item.name }"
                class="nav-link"
                :exact-active-class="item.name === 'dashboard' ? 'active' : ''"
                :active-class="item.name === 'dashboard' ? '' : 'active'"
              >
                <span class="nav-link-icon d-md-none d-lg-inline-block"><i :class="['ti', item.icon]"></i></span>
                <span class="nav-link-title">{{ item.label }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </header>

    <div class="page-wrapper">
      <RouterView />
      <footer class="footer footer-transparent d-print-none">
        <div class="container-xl text-secondary small">Dash3 — ERP</div>
      </footer>
    </div>
  </div>
</template>
