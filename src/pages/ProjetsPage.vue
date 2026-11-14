<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'

const route = useRoute()
const router = useRouter()

const clientId = computed(() => route.query.client_id)
const params = {}
const list = usePaginatedList('/projets', params)
const { items, page, lastPage, total, search, loading, error } = list

function load(p = 1) {
  params.client_id = clientId.value || undefined
  return list.load(p)
}

onMounted(() => load(1))
watch(clientId, () => load(1))

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
</script>

<template>
  <PageHeader title="Projets" pretitle="ERP">
    <template #actions>
      <button v-if="clientId" class="btn btn-outline-secondary" @click="router.push({ name: 'projets' })">
        <i class="ti ti-x me-1"></i>Tous les clients
      </button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 320px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Rechercher un projet…" />
          </div>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Projet</th>
                <th>Début</th>
                <th>Fin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="3" class="text-center py-4"><div class="spinner-border text-secondary"></div></td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="3" class="text-center text-secondary py-4">Aucun projet</td>
              </tr>
              <template v-else>
                <tr v-for="p in items" :key="p.id">
                  <td>
                    <div class="fw-medium">
                      {{ p.name }}
                      <i v-if="p.favorite" class="ti ti-star-filled text-yellow ms-1"></i>
                    </div>
                    <div class="text-secondary small text-truncate" style="max-width: 420px">{{ p.description }}</div>
                  </td>
                  <td class="text-secondary">{{ formatDate(p.start_date) }}</td>
                  <td class="text-secondary">{{ formatDate(p.end_date) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
      </div>
    </div>
  </div>
</template>
