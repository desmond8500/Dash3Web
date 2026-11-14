<script setup>
import { onMounted } from 'vue'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'

const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/tasks', { per_page: 15 })

onMounted(() => load(1))

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

function isLate(t) {
  return t.expiration_date && new Date(t.expiration_date) < new Date()
}
</script>

<template>
  <PageHeader title="Tâches" />

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 320px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Rechercher une tâche…" />
          </div>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Tâche</th>
                <th>Échéance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="2" class="text-center py-4"><div class="spinner-border text-secondary"></div></td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="2" class="text-center text-secondary py-4">Aucune tâche</td>
              </tr>
              <template v-else>
                <tr v-for="t in items" :key="t.id">
                  <td>
                    <div class="fw-medium">{{ t.name }}</div>
                    <div class="text-secondary small text-truncate" style="max-width: 520px">{{ t.description }}</div>
                  </td>
                  <td>
                    <span :class="isLate(t) ? 'badge bg-red-lt' : 'text-secondary'">{{ formatDate(t.expiration_date) }}</span>
                  </td>
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
