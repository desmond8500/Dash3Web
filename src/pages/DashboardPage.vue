<script setup>
import { onMounted, ref } from 'vue'
import api, { normalizeList } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()

const stats = ref([
  { key: 'clients', label: 'Clients', icon: 'ti-users', color: 'bg-primary', endpoint: '/clients', route: 'clients', value: null },
  { key: 'projets', label: 'Projets', icon: 'ti-briefcase', color: 'bg-green', endpoint: '/projets', route: 'projets', value: null },
  { key: 'taches', label: 'Tâches', icon: 'ti-checklist', color: 'bg-orange', endpoint: '/tasks', route: 'taches', value: null },
])

onMounted(() => {
  stats.value.forEach(async (s) => {
    try {
      const { data } = await api.get(s.endpoint, { params: { per_page: 1 } })
      s.value = normalizeList(data).total
    } catch {
      s.value = '—'
    }
  })
})
</script>

<template>
  <PageHeader title="Tableau de bord" :pretitle="auth.displayName ? `Bonjour ${auth.displayName}` : ''" />

  <div class="page-body">
    <div class="container-xl">
      <div class="row row-deck row-cards">
        <div v-for="s in stats" :key="s.key" class="col-sm-6 col-lg-4">
          <RouterLink :to="{ name: s.route }" class="card card-sm card-link">
            <div class="card-body">
              <div class="row align-items-center">
                <div class="col-auto">
                  <span :class="['text-white avatar', s.color]"><i :class="['ti', s.icon]"></i></span>
                </div>
                <div class="col">
                  <div class="fw-medium">{{ s.label }}</div>
                  <div class="text-secondary">
                    <span v-if="s.value === null" class="placeholder col-4"></span>
                    <span v-else>{{ s.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
