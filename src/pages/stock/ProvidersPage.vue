<script setup>
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { listProviders } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'

const providers = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    providers.value = await listProviders()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return providers.value
  return providers.value.filter((p) => [p.name, p.email, p.phone, p.address].some((v) => v?.toLowerCase().includes(q)))
})
</script>

<template>
  <PageHeader title="Fournisseurs" />

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 360px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Nom, e-mail, téléphone…" />
          </div>
          <span class="ms-auto text-secondary">{{ filtered.length }} fournisseur(s)</span>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr><th>Nom</th><th>Téléphone</th><th>E-mail</th><th>Adresse</th><th class="w-1"></th></tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="5" class="text-center py-4"><div class="spinner-border text-secondary"></div></td></tr>
              <tr v-else-if="!filtered.length"><td colspan="5" class="text-center text-secondary py-4">Aucun fournisseur</td></tr>
              <template v-else>
                <tr v-for="p in filtered" :key="p.id">
                  <td>
                    <div class="fw-medium">{{ p.name }}</div>
                    <div v-if="p.description" class="text-secondary small text-truncate" style="max-width: 260px">{{ p.description }}</div>
                  </td>
                  <td><a v-if="p.phone" :href="`tel:${p.phone}`">{{ p.phone }}</a></td>
                  <td><a v-if="p.email" :href="`mailto:${p.email}`">{{ p.email }}</a></td>
                  <td class="text-secondary">{{ p.address }}</td>
                  <td>
                    <a v-if="p.website" :href="p.website" target="_blank" rel="noopener" class="btn btn-icon btn-ghost-secondary" title="Site web">
                      <i class="ti ti-world"></i>
                    </a>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
