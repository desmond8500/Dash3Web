<script setup>
/** Liste des journaux : recherche, création, accès à la page du journal. */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, saveJournal } from '@/api/dash3'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const router = useRouter()
const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/journaux', { per_page: 12 })
load(1)

const fields = [
  { name: 'title', label: 'Titre', required: true, col: 'col-md-8' },
  { name: 'date', label: 'Date', type: 'date', required: true, col: 'col-md-4', default: new Date().toISOString().slice(0, 10) },
  { name: 'type', label: 'Type', placeholder: 'Visite, réunion, intervention…' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const open = ref(false)
let created = null
const submit = async (v) => {
  const { data } = await saveJournal(v)
  created = data?.data
}
function onSaved() {
  open.value = false
  if (created?.id) router.push({ name: 'journal', params: { id: created.id } })
  else load(1)
}
</script>

<template>
  <PageHeader title="Journaux">
    <template #actions>
      <button class="btn btn-primary" @click="open = true"><i class="ti ti-plus"></i> Journal</button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="card mb-2">
        <div class="card-body py-2">
          <div class="input-icon" style="max-width: 360px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Rechercher un journal…" />
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
      <div v-else-if="!items.length" class="card card-body text-secondary text-center">Aucun journal</div>

      <div v-else class="row row-cards">
        <div v-for="j in items" :key="j.id" class="col-md-6 col-xl-4">
          <div class="card h-100">
            <div class="card-header">
              <div class="min-w-0">
                <RouterLink :to="{ name: 'journal', params: { id: j.id } }" class="card-title text-reset d-block text-truncate">{{ j.title }}</RouterLink>
                <div class="text-secondary small">
                  {{ formatDate(j.date) }}<span v-if="j.type"> · {{ j.type }}</span>
                </div>
              </div>
            </div>
            <div class="card-body py-2">
              <div v-if="j.projet" class="small mb-1">
                <i class="ti ti-folder text-secondary"></i>
                <RouterLink :to="{ name: 'projet', params: { id: j.projet.id } }">{{ j.projet.name }}</RouterLink>
                <span v-if="j.projet.client" class="text-secondary"> · {{ j.projet.client.name }}</span>
              </div>
              <div v-if="j.description" class="text-secondary small description-clamp">{{ j.description }}</div>
            </div>
            <div class="card-footer d-flex align-items-center py-2">
              <span class="badge bg-azure-lt me-1"><i class="ti ti-list-details"></i> {{ j.sections_count ?? 0 }}</span>
              <span class="badge bg-primary-lt"><i class="ti ti-users"></i> {{ j.intervenants_count ?? 0 }}</span>
              <RouterLink :to="{ name: 'journal', params: { id: j.id } }" class="btn btn-sm btn-primary ms-auto">Ouvrir</RouterLink>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="card">
            <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal :show="open" title="Nouveau journal" :fields="fields" :submit="submit" @close="open = false" @saved="onSaved" />
</template>

<style scoped>
.description-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
}
</style>
