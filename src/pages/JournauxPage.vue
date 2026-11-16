<script setup>
/** Liste des journaux : recherche, création, accès à la page du journal. */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/client'
import { deleteJournal, saveJournal } from '@/api/dash3'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import JournalCard from '@/components/cards/JournalCard.vue'

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
const editing = ref(null)
function edit(j = null) {
  editing.value = j
  open.value = true
}
let created = null
const submit = async (v) => {
  const { data } = await saveJournal(v, editing.value?.id)
  created = editing.value ? null : data?.data
}
function onSaved() {
  open.value = false
  if (created?.id) router.push({ name: 'journal', params: { id: created.id } })
  else load(page.value)
}
async function remove(j) {
  if (!confirm(`Supprimer le journal « ${j.title} » ?`)) return
  try {
    await deleteJournal(j.id)
    await load(page.value)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader title="Journaux">
    <template #actions>
      <button class="btn btn-primary" @click="edit()"><i class="ti ti-plus"></i> Journal</button>
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
          <JournalCard :journal="j" counts @edit="edit" @delete="remove" />
        </div>
        <div class="col-12">
          <div class="card">
            <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="open"
    :title="editing ? 'Modifier le journal' : 'Nouveau journal'"
    :fields="fields"
    :initial="editing"
    :submit="submit"
    @close="open = false"
    @saved="onSaved"
  />
</template>

