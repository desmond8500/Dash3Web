<script setup>
/** Page Fournisseurs, reprise de livewire/stock/providers-page.blade.php. */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { deleteProvider, listProviders, saveProvider } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'

const providers = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    providers.value = await listProviders()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return providers.value
  return providers.value.filter((p) => [p.name, p.email, p.phone, p.address].some((v) => v?.toLowerCase().includes(q)))
})

const fields = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'phone', label: 'Téléphone', type: 'tel', col: 'col-md-6' },
  { name: 'email', label: 'E-mail', type: 'email', col: 'col-md-6' },
  { name: 'website', label: 'Site web', type: 'url' },
  { name: 'address', label: 'Adresse' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const formOpen = ref(false)
const editing = ref(null)
const logoOpen = ref(false)
const logoProvider = ref(null)

function openForm(p = null) {
  editing.value = p
  formOpen.value = true
}
function openLogo(p) {
  logoProvider.value = p
  logoOpen.value = true
}
async function onSaved() {
  formOpen.value = false
  logoOpen.value = false
  await load()
}
async function remove(p) {
  if (!confirm(`Supprimer le fournisseur « ${p.name} » ?`)) return
  try {
    await deleteProvider(p.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const articles = (n) => `${n ?? 0} ${(n ?? 0) > 1 ? 'Articles' : 'Article'}`
</script>

<template>
  <PageHeader title="Fournisseurs" :loading="loading">
    <template #actions>
      <div class="row g-2">
        <div class="col">
          <div class="input-icon w-100">
            <input v-model="search" type="text" class="form-control form-control-rounded" placeholder="Chercher un fournisseur" />
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
          </div>
        </div>
        <div class="col-auto">
          <button class="btn btn-primary" @click="openForm()"><i class="ti ti-plus"></i> Fournisseur</button>
        </div>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="!loading && !filtered.length" class="empty">
        <div class="empty-icon"><i class="ti ti-mood-empty" style="font-size: 3rem"></i></div>
        <p class="empty-title">Aucun fournisseur</p>
      </div>

      <div class="row row-deck g-2">
        <div v-for="p in filtered" :key="p.id" class="col-md-4">
          <div class="card p-2">
            <div class="row g-2">
              <div class="col-auto">
                <img v-if="p.logo_url" :src="p.logo_url" alt="" class="avatar avatar-xl rounded-2" style="object-fit: contain" />
                <span v-else class="avatar avatar-xl rounded-2"><i class="ti ti-building" style="font-size: 2rem"></i></span>
              </div>
              <div class="col d-flex flex-column">
                <div class="card-title mb-1">{{ p.name }}</div>
                <div v-if="p.description" class="text-muted description">{{ p.description }}</div>
                <div class="small mt-1">
                  <a v-if="p.phone" :href="`tel:${p.phone}`" class="me-2"><i class="ti ti-phone"></i>{{ p.phone }}</a>
                  <a v-if="p.email" :href="`mailto:${p.email}`"><i class="ti ti-mail"></i>{{ p.email }}</a>
                </div>
                <div class="mt-auto pt-1">{{ articles(p.articles_count) }}</div>
              </div>
              <div class="col-auto">
                <div class="dropdown">
                  <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
                    <i class="ti ti-chevron-down"></i>
                  </button>
                  <div class="dropdown-menu dropdown-menu-end">
                    <button class="dropdown-item" type="button" @click="openForm(p)"><i class="ti ti-edit"></i> Éditer</button>
                    <button class="dropdown-item" type="button" @click="openLogo(p)"><i class="ti ti-photo-edit"></i> Éditer logo</button>
                    <a v-if="p.website" class="dropdown-item" :href="p.website" target="_blank" rel="noopener"><i class="ti ti-world"></i> Site web</a>
                    <button class="dropdown-item text-danger" type="button" @click="remove(p)"><i class="ti ti-trash"></i> Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="formOpen"
    :title="editing ? 'Editer un fournisseur' : 'Ajouter un fournisseur'"
    :fields="fields"
    :initial="editing"
    :submit="(v) => saveProvider(v, editing?.id)"
    @close="formOpen = false"
    @saved="onSaved"
  />
  <ImageUploadModal
    :show="logoOpen"
    title="Éditer un logo"
    :endpoint="logoProvider ? `/providers/${logoProvider.id}/logo` : ''"
    :current="logoProvider?.logo_url"
    @close="logoOpen = false"
    @saved="onSaved"
  />
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
