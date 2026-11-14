<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BackToTop from '@/components/BackToTop.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

/**
 * Menu repris de la barre de navigation de Dash3 (app/Livewire/Layout/Navbar.php),
 * limité aux entrées demandées dans todo.md.
 */
const menus = [
  {
    name: 'ERP',
    icon: 'ti-users',
    submenu: [
      { name: 'Clients', route: 'clients', icon: 'ti-users' },
      { name: 'Documents', route: 'documents', icon: 'ti-file' },
      { name: 'Équipe', route: 'equipe', icon: 'ti-users-group' },
    ],
  },
  {
    name: 'Stock',
    icon: 'ti-packages',
    submenu: [
      { name: 'Articles', route: 'articles', icon: 'ti-packages' },
      { name: 'Achats', route: 'achats', icon: 'ti-shopping-cart' },
      { name: 'Marques', route: 'marques', icon: 'ti-brand-cake' },
      { name: 'Fournisseurs', route: 'fournisseurs', icon: 'ti-building' },
    ],
  },
  {
    name: 'Comptabilité',
    icon: 'ti-coins',
    submenu: [{ name: 'Bilan mensuel', route: 'bilan', icon: 'ti-report-money' }],
  },
]

// Un menu est actif si la page courante fait partie de ses sous-menus
const isActive = (menu) => menu.submenu.some((s) => s.route === route.name || route.meta.section === s.route)

// Sur mobile, on referme le menu après une navigation
const menuOpen = ref(false)
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="page">
    <header class="navbar navbar-expand-md d-print-none sticky-top">
      <div class="container-xl">
        <button
          class="navbar-toggler"
          type="button"
          aria-controls="navbar-menu"
          :aria-expanded="menuOpen"
          aria-label="Ouvrir le menu"
          @click="menuOpen = !menuOpen"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          <RouterLink :to="{ name: 'dashboard' }" class="d-flex align-items-center gap-2 text-reset text-decoration-none">
            <img src="/logo.svg" alt="" width="32" height="32" class="navbar-brand-image" />
            <span class="fw-bold">Dash3</span>
          </RouterLink>
        </div>

        <!-- Menu utilisateur -->
        <div class="navbar-nav flex-row order-md-last">
          <div class="nav-item dropdown">
            <a href="#" class="nav-link d-flex lh-1 p-0 px-2" data-bs-toggle="dropdown" aria-label="Menu utilisateur" @click.prevent>
              <img
                v-if="auth.user?.avatar"
                :src="auth.user.avatar"
                alt=""
                class="avatar avatar-sm rounded-2 border border-secondary"
              />
              <span v-else class="avatar avatar-sm rounded-2"><i class="ti ti-user"></i></span>
              <div class="d-none d-xl-block ps-2">
                <div>{{ auth.displayName }}</div>
                <div class="mt-1 small text-secondary">{{ auth.user?.function || '_' }}</div>
              </div>
            </a>
            <div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
              <RouterLink :to="{ name: 'profil' }" class="dropdown-item"><i class="ti ti-user me-1"></i>Profil</RouterLink>
              <RouterLink :to="{ name: 'cvs' }" class="dropdown-item"><i class="ti ti-file-cv me-1"></i>Mes CVs</RouterLink>
              <div class="dropdown-divider"></div>
              <a href="#" class="dropdown-item text-danger" @click.prevent="logout"><i class="ti ti-logout me-1"></i>Déconnexion</a>
            </div>
          </div>
        </div>

        <!-- Menu principal -->
        <div id="navbar-menu" class="collapse navbar-collapse" :class="{ show: menuOpen }">
          <div class="d-flex flex-column flex-md-row flex-fill align-items-stretch align-items-md-center">
            <ul class="navbar-nav">
              <li class="nav-item" :class="{ active: route.name === 'dashboard' }">
                <RouterLink :to="{ name: 'dashboard' }" class="nav-link" active-class="" exact-active-class="">
                  <span class="nav-link-icon d-md-none d-lg-inline-block"><i class="ti ti-home"></i></span>
                  <span class="nav-link-title">Accueil</span>
                </RouterLink>
              </li>

              <li v-for="menu in menus" :key="menu.name" class="nav-item dropdown" :class="{ active: isActive(menu) }">
                <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown" role="button" aria-expanded="false" @click.prevent>
                  <span class="nav-link-icon d-md-none d-lg-inline-block"><i :class="['ti', menu.icon]"></i></span>
                  <span class="nav-link-title">{{ menu.name }}</span>
                </a>
                <div class="dropdown-menu">
                  <RouterLink
                    v-for="item in menu.submenu"
                    :key="item.route"
                    :to="{ name: item.route }"
                    class="dropdown-item"
                    active-class="active"
                  >
                    <span class="nav-link-icon d-md-none d-lg-inline-block"><i :class="['ti', item.icon]"></i></span>
                    {{ item.name }}
                  </RouterLink>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>

    <div class="page-wrapper">
      <RouterView />
      <footer class="footer footer-transparent d-print-none">
        <div class="container-xl text-secondary small">Dash3 — ERP</div>
      </footer>
    </div>

    <BackToTop />
  </div>
</template>
