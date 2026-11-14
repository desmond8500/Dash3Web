<script setup>
/** Page Mes CV : création, renommage et suppression des CV de l'utilisateur connecté. */
import { onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { deleteCv, formatDate, listCvs, saveCv } from '@/api/dash3'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const auth = useAuthStore()
const cvs = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    cvs.value = await listCvs()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const fields = [{ name: 'name', label: 'Nom du CV', required: true, placeholder: 'CV technique 2026' }]
const open = ref(false)
const editing = ref(null)
function edit(cv = null) {
  editing.value = cv
  open.value = true
}
const submit = (v) => saveCv(v, editing.value?.id)
async function onSaved() {
  open.value = false
  await load()
}
async function remove(cv) {
  if (!confirm(`Supprimer le CV « ${cv.name} » ?`)) return
  try {
    await deleteCv(cv.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader title="Mes CV" :breadcrumbs="[{ name: 'Paramètres' }, { name: 'Mes CV' }]">
    <template #actions>
      <button class="btn btn-primary" @click="edit()"><i class="ti ti-plus"></i> CV</button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
      <div v-else-if="!cvs.length" class="empty">
        <div class="empty-icon"><i class="ti ti-file-cv" style="font-size: 3rem"></i></div>
        <p class="empty-title">Aucun CV</p>
        <p class="empty-subtitle text-secondary">Créez un CV pour rassembler vos expériences et vos compétences.</p>
        <div class="empty-action"><button class="btn btn-primary" @click="edit()"><i class="ti ti-plus"></i> Créer un CV</button></div>
      </div>

      <div v-else class="row row-cards">
        <div v-for="cv in cvs" :key="cv.id" class="col-md-6 col-xl-4">
          <div class="card h-100">
            <div class="card-body d-flex align-items-center gap-2">
              <span class="avatar avatar-md rounded-2 bg-primary-lt"><i class="ti ti-file-cv" style="font-size: 1.5rem"></i></span>
              <div class="min-w-0">
                <div class="fw-bold text-truncate">{{ cv.name }}</div>
                <div class="text-secondary small">{{ auth.displayName }} · créé le {{ formatDate(cv.created_at) }}</div>
              </div>
            </div>
            <div class="card-footer d-flex py-2">
              <button class="btn btn-sm" @click="edit(cv)"><i class="ti ti-edit"></i> Renommer</button>
              <button class="btn btn-sm btn-ghost-danger ms-auto" @click="remove(cv)"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="open"
    :title="editing ? 'Renommer le CV' : 'Nouveau CV'"
    :fields="fields"
    :initial="editing"
    :submit="submit"
    @close="open = false"
    @saved="onSaved"
  />
</template>
