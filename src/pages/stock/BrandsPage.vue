<script setup>
/** Page Marques, reprise de livewire/stock/brands-page.blade.php et _card/brand_card. */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { deleteBrand, listBrands, saveBrand } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'

const brands = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    brands.value = await listBrands()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? brands.value.filter((b) => b.name?.toLowerCase().includes(q)) : brands.value
})

const fields = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const formOpen = ref(false)
const editing = ref(null)
const logoOpen = ref(false)
const logoBrand = ref(null)

function openForm(brand = null) {
  editing.value = brand
  formOpen.value = true
}
function openLogo(brand) {
  logoBrand.value = brand
  logoOpen.value = true
}
async function onSaved() {
  formOpen.value = false
  logoOpen.value = false
  await load()
}
async function remove(brand) {
  if (!confirm(`Supprimer la marque « ${brand.name} » ?`)) return
  try {
    await deleteBrand(brand.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const articles = (n) => `${n ?? 0} ${(n ?? 0) > 1 ? 'Articles' : 'Article'}`
</script>

<template>
  <PageHeader title="Marques" :loading="loading">
    <template #actions>
      <div class="btn-list">
        <input v-model="search" type="text" class="form-control form-control-rounded w-auto" placeholder="Chercher une marque" />
        <button class="btn btn-primary" @click="openForm()"><i class="ti ti-plus"></i> Marque</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="!loading && !filtered.length" class="empty">
        <div class="empty-icon"><i class="ti ti-mood-empty" style="font-size: 3rem"></i></div>
        <p class="empty-title">Aucune marque</p>
      </div>

      <div class="row row-deck g-2">
        <div v-for="b in filtered" :key="b.id" class="col-md-3 col-6">
          <div class="card p-2 position-relative">
            <div class="text-center">
              <img v-if="b.logo_url" :src="b.logo_url" :alt="b.name" class="img-fluid rounded-2" style="max-height: 100px; margin: auto; display: block" />
              <span v-else class="avatar avatar-xl rounded-2"><i class="ti ti-photo-off" style="font-size: 2rem"></i></span>
            </div>
            <div class="card-title text-center mt-2 mb-1">{{ b.name }}</div>
            <div v-if="b.description" class="text-muted description">{{ b.description }}</div>
            <div class="text-center mt-auto">{{ articles(b.articles_count) }}</div>

            <div class="dropdown" style="position: absolute; top: 0; right: 0">
              <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
                <i class="ti ti-chevron-down"></i>
              </button>
              <div class="dropdown-menu dropdown-menu-end">
                <button class="dropdown-item" type="button" @click="openForm(b)"><i class="ti ti-edit"></i> Éditer</button>
                <button class="dropdown-item" type="button" @click="openLogo(b)"><i class="ti ti-photo-edit"></i> Éditer image</button>
                <button class="dropdown-item text-danger" type="button" @click="remove(b)"><i class="ti ti-trash"></i> Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="formOpen"
    :title="editing ? 'Editer une marque' : 'Ajouter une marque'"
    :fields="fields"
    :initial="editing"
    :submit="(v) => saveBrand(v, editing?.id)"
    @close="formOpen = false"
    @saved="onSaved"
  />
  <ImageUploadModal
    :show="logoOpen"
    title="Éditer l'image de la marque"
    :endpoint="logoBrand ? `/brands/${logoBrand.id}/logo` : ''"
    :current="logoBrand?.logo_url"
    @close="logoOpen = false"
    @saved="onSaved"
  />
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
