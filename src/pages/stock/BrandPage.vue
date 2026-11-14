<script setup>
/** Page Marque, reprise de livewire/stock/brand-page.blade.php : infos, liens, articles de la marque. */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import { addBrandLink, deleteBrandLink, getBrand, saveBrand } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import ArticlesSection from '@/components/stock/ArticlesSection.vue'

const route = useRoute()
const id = computed(() => route.params.id)

const brand = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    brand.value = await getBrand(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(id, load)

const breadcrumbs = computed(() => [
  { name: 'Stock' },
  { name: 'Marques', to: { name: 'marques' } },
  { name: brand.value?.name || 'Marque' },
])

// Édition + logo
const fields = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const formOpen = ref(false)
const logoOpen = ref(false)
async function onSaved() {
  formOpen.value = false
  logoOpen.value = false
  await load()
}

// Liens de la marque
const linkFields = [
  { name: 'name', label: 'Nom', required: true, placeholder: 'Portail revendeur' },
  { name: 'link', label: 'URL', type: 'url', required: true, placeholder: 'https://…' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const linkOpen = ref(false)
const submitLink = (v) => addBrandLink(brand.value.id, v)
async function onLinkSaved() {
  linkOpen.value = false
  await load()
}
async function removeLink(l) {
  if (!confirm(`Supprimer le lien « ${l.name} » ?`)) return
  try {
    await deleteBrandLink(l.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader :title="brand ? `Marque: ${brand.name}` : 'Marque'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="brand" class="btn-list">
        <button class="btn" @click="logoOpen = true"><i class="ti ti-photo-edit"></i> Logo</button>
        <button class="btn btn-primary" @click="formOpen = true"><i class="ti ti-edit"></i> Modifier</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="brand" class="row g-3">
        <div class="col-md-4">
          <div class="card mb-3">
            <div class="card-body text-center">
              <img v-if="brand.logo_url" :src="brand.logo_url" :alt="brand.name" class="img-fluid rounded-2 mb-2" style="max-height: 120px" />
              <span v-else class="avatar avatar-xl rounded-2 mb-2"><i class="ti ti-photo-off" style="font-size: 2rem"></i></span>
              <h2 class="m-0">{{ brand.name }}</h2>
              <div class="text-secondary">{{ brand.articles_count }} article(s)</div>
              <div v-if="brand.description" class="text-secondary mt-2 description">{{ brand.description }}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-link"></i>Liens</h3>
              <button class="btn btn-sm btn-ghost-primary ms-auto" @click="linkOpen = true"><i class="ti ti-plus"></i> Lien</button>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!brand.links?.length" class="list-group-item text-secondary small">Aucun lien</div>
              <div v-for="l in brand.links" :key="l.id" class="list-group-item d-flex align-items-center">
                <div class="min-w-0">
                  <a :href="l.url" target="_blank" rel="noopener" class="text-truncate d-block"><i class="ti ti-link me-1"></i>{{ l.name }}</a>
                  <div v-if="l.description" class="text-secondary small text-truncate">{{ l.description }}</div>
                </div>
                <button class="btn btn-icon btn-ghost-danger ms-auto" title="Supprimer" @click="removeLink(l)"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-8">
          <ArticlesSection :key="`brand-${id}`" :filter="{ brand_id: Number(id) }" col="col-xl-6" />
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal :show="formOpen" title="Editer la marque" :fields="fields" :initial="brand" :submit="(v) => saveBrand(v, brand.id)" @close="formOpen = false" @saved="onSaved" />
  <NamedFormModal :show="linkOpen" title="Ajouter un lien" :fields="linkFields" :submit="submitLink" @close="linkOpen = false" @saved="onLinkSaved" />
  <ImageUploadModal :show="logoOpen" title="Logo de la marque" :endpoint="brand ? `/brands/${brand.id}/logo` : ''" :current="brand?.logo_url" @close="logoOpen = false" @saved="onSaved" />
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
