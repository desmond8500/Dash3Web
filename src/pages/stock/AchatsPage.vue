<script setup>
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { formatAmount, formatDate, listAchats } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'

const achats = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    // Les plus récents en premier
    achats.value = (await listAchats()).sort((a, b) => String(b.date ?? b.created_at).localeCompare(String(a.date ?? a.created_at)))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return achats.value
  return achats.value.filter((a) => [a.name, a.description, a.provider?.name].some((v) => v?.toLowerCase().includes(q)))
})

const totalTtc = computed(() => filtered.value.reduce((sum, a) => sum + Number(a.ttc || 0), 0))
</script>

<template>
  <PageHeader title="Achats" />

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 360px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Achat ou fournisseur…" />
          </div>
          <span class="ms-auto text-secondary">{{ filtered.length }} achat(s) · {{ formatAmount(totalTtc) }} TTC</span>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Achat</th>
                <th>Fournisseur</th>
                <th>Date</th>
                <th>Statut</th>
                <th class="text-end">HT</th>
                <th class="text-end">TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="6" class="text-center py-4"><div class="spinner-border text-secondary"></div></td></tr>
              <tr v-else-if="!filtered.length"><td colspan="6" class="text-center text-secondary py-4">Aucun achat</td></tr>
              <template v-else>
                <tr v-for="(a, i) in filtered" :key="i">
                  <td>
                    <div class="fw-medium">{{ a.name }}</div>
                    <div v-if="a.description" class="text-secondary small text-truncate" style="max-width: 280px">{{ a.description }}</div>
                  </td>
                  <td>{{ a.provider?.name }}</td>
                  <td class="text-secondary">{{ formatDate(a.date) }}</td>
                  <td><span v-if="a.status" class="badge bg-blue-lt">{{ a.status }}</span></td>
                  <td class="text-end">{{ formatAmount(a.total) }}</td>
                  <td class="text-end fw-medium">{{ formatAmount(a.ttc) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
