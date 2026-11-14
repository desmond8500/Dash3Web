<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api, { normalizeList } from '@/api/client'
import { formatAmount, globalSearch } from '@/api/dash3'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()

// ---------- Date du jour ----------
const today = new Date()
const todayLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const todayCapitalized = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)

// Jours de la semaine en cours (lundi → dimanche), pour la section planning
const week = computed(() => {
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      key: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    }
  })
})

// ---------- Compteurs ----------
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

// ---------- Recherche : clients, projets, devis ----------
const search = ref('')
const searching = ref(false)
const results = ref(null)
let timer
let lastRun = 0

watch(search, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) {
    results.value = null
    searching.value = false
    return
  }
  searching.value = true
  timer = setTimeout(async () => {
    const run = ++lastRun
    const res = await globalSearch(q.trim())
    if (run !== lastRun) return
    results.value = res
    searching.value = false
  }, 350)
})

const sections = computed(() =>
  results.value
    ? [
        { key: 'clients', title: 'Clients', icon: 'ti-users', ...results.value.clients },
        { key: 'projets', title: 'Projets', icon: 'ti-briefcase', ...results.value.projets },
        { key: 'devis', title: 'Devis', icon: 'ti-file-invoice', ...results.value.devis },
      ]
    : [],
)
const noResult = computed(() => sections.value.length && sections.value.every((s) => !s.items.length && !s.error))
</script>

<template>
  <PageHeader title="Tableau de bord" />

  <div class="page-body">
    <div class="container-xl">
      <div class="row row-deck row-cards">
        <!-- Bienvenue + date -->
        <div class="col-12">
          <div class="card">
            <div class="card-body d-flex flex-wrap align-items-center gap-3">
              <span class="avatar rounded-2 avatar-md bg-primary-lt"><i class="ti ti-calendar-event fs-2"></i></span>
              <div>
                <div class="text-secondary small">Aujourd'hui</div>
                <div class="h3 m-0">{{ todayCapitalized }}</div>
              </div>
              <div v-if="auth.displayName" class="ms-md-auto text-secondary">Bonjour {{ auth.displayName }}</div>
            </div>
          </div>
        </div>

        <!-- Recherche -->
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <div class="input-icon">
                <span class="input-icon-addon"><i class="ti ti-search"></i></span>
                <input v-model="search" type="search" class="form-control form-control-lg" placeholder="Rechercher un client, un projet ou un devis…" aria-label="Recherche" />
                <span v-if="searching" class="input-icon-addon"><span class="spinner-border spinner-border-sm"></span></span>
              </div>

              <div v-if="noResult" class="text-secondary mt-3">Aucun résultat pour « {{ search }} ».</div>

              <div v-else-if="sections.length" class="row g-3 mt-1">
                <div v-for="s in sections" :key="s.key" class="col-md-4">
                  <div class="fw-bold mb-2">
                    <i :class="['ti', s.icon]"></i>{{ s.title }}
                    <span class="badge bg-secondary-lt ms-1">{{ s.total }}</span>
                  </div>
                  <div v-if="s.error" class="text-danger small">{{ s.error }}</div>
                  <div v-else-if="!s.items.length" class="text-secondary small">Aucun résultat</div>
                  <div v-else class="list-group list-group-flush">
                    <template v-if="s.key === 'clients'">
                      <RouterLink
                        v-for="c in s.items"
                        :key="c.id"
                        :to="{ name: 'projets', query: { client_id: c.id } }"
                        class="list-group-item list-group-item-action px-0"
                      >
                        <div class="fw-medium">{{ c.name }}</div>
                        <div class="text-secondary small text-truncate">{{ c.description || c.address }}</div>
                      </RouterLink>
                    </template>
                    <template v-else-if="s.key === 'projets'">
                      <RouterLink
                        v-for="p in s.items"
                        :key="p.id"
                        :to="{ name: 'projet', params: { id: p.id } }"
                        class="list-group-item list-group-item-action px-0"
                      >
                        <div class="fw-medium">{{ p.name }}</div>
                        <div class="text-secondary small text-truncate">{{ p.description }}</div>
                      </RouterLink>
                    </template>
                    <template v-else>
                      <div v-for="d in s.items" :key="d.id" class="list-group-item px-0">
                        <div class="d-flex">
                          <div class="fw-medium">{{ d.reference }}</div>
                          <div class="ms-auto">{{ formatAmount(d.montant) }}</div>
                        </div>
                        <div class="text-secondary small text-truncate">
                          {{ d.client_name }}<span v-if="d.projet_name"> · {{ d.projet_name }}</span>
                          <span v-if="d.statut" class="badge bg-blue-lt ms-1">{{ d.statut }}</span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Compteurs -->
        <div v-for="s in stats" :key="s.key" class="col-sm-6 col-lg-4">
          <RouterLink :to="{ name: s.route }" class="card card-sm card-link">
            <div class="card-body">
              <div class="row align-items-center">
                <div class="col-auto">
                  <span :class="['text-white avatar rounded-2', s.color]"><i :class="['ti', s.icon]"></i></span>
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

        <!-- Planning de la semaine (à développer) -->
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-calendar-week"></i>Planning de la semaine</h3>
              <span class="badge bg-yellow-lt ms-auto">À venir</span>
            </div>
            <div class="card-body">
              <div class="row g-2 text-center">
                <div v-for="d in week" :key="d.key" class="col">
                  <div class="border rounded p-2" :class="d.isToday ? 'border-primary bg-primary-lt' : ''">
                    <div class="text-secondary small text-capitalize">{{ d.day }}</div>
                    <div class="h3 m-0">{{ d.date }}</div>
                  </div>
                </div>
              </div>
              <p class="text-secondary small mt-3 mb-0">Les interventions et tâches planifiées s'afficheront ici.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
