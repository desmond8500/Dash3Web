<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/client'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const error = ref('')

// Rafraîchit les informations depuis /me à l'ouverture de la page
onMounted(async () => {
  loading.value = true
  try {
    await auth.fetchMe()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <PageHeader title="Profil" :loading="loading" />

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="row row-cards">
        <div class="col-md-4">
          <div class="card">
            <div class="card-body p-4 text-center">
              <span
                class="avatar avatar-xl mb-3 rounded"
                :style="auth.user?.avatar ? { backgroundImage: `url(${auth.user.avatar})` } : null"
              >
                <i v-if="!auth.user?.avatar" class="ti ti-user" style="font-size: 2rem"></i>
              </span>
              <h3 class="m-0 mb-1">{{ auth.displayName || '—' }}</h3>
              <div class="text-secondary">{{ auth.user?.function || '_' }}</div>
            </div>
            <div class="d-flex">
              <a v-if="auth.user?.email" :href="`mailto:${auth.user.email}`" class="card-btn"><i class="ti ti-mail me-2 text-muted"></i>E-mail</a>
              <a href="#" class="card-btn text-danger" @click.prevent="logout"><i class="ti ti-logout me-2"></i>Déconnexion</a>
            </div>
          </div>
        </div>

        <div class="col-md-8">
          <div class="card">
            <div class="card-header"><h3 class="card-title">Informations</h3></div>
            <div class="card-body">
              <div class="datagrid">
                <div class="datagrid-item">
                  <div class="datagrid-title">Prénom</div>
                  <div class="datagrid-content">{{ auth.user?.firstname || '—' }}</div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Nom</div>
                  <div class="datagrid-content">{{ auth.user?.lastname || '—' }}</div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">E-mail</div>
                  <div class="datagrid-content">{{ auth.user?.email || '—' }}</div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Fonction</div>
                  <div class="datagrid-content">{{ auth.user?.function || '—' }}</div>
                </div>
              </div>
            </div>
            <div class="card-footer text-secondary small">
              La modification du profil se fait pour l'instant dans Dash3.
            </div>
          </div>

          <div class="card mt-3">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-file-cv"></i>Mes CVs</h3>
              <span class="badge bg-yellow-lt ms-auto">À venir</span>
            </div>
            <div class="card-body text-secondary">Vos CVs seront consultables ici dans une prochaine version.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
