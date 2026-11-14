<script setup>
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { listBrands } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'

const brands = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    brands.value = await listBrands()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? brands.value.filter((b) => b.name?.toLowerCase().includes(q)) : brands.value
})
</script>

<template>
  <PageHeader title="Marques" />

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 360px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Rechercher une marque…" />
          </div>
          <span class="ms-auto text-secondary">{{ filtered.length }} marque(s)</span>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr><th>Nom</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="2" class="text-center py-4"><div class="spinner-border text-secondary"></div></td></tr>
              <tr v-else-if="!filtered.length"><td colspan="2" class="text-center text-secondary py-4">Aucune marque</td></tr>
              <template v-else>
                <tr v-for="b in filtered" :key="b.id">
                  <td class="fw-medium">{{ b.name }}</td>
                  <td class="text-secondary">{{ b.description }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
