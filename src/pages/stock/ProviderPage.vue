<script setup>
/**
 * Page Fournisseur, reprise de livewire/stock/provider-page.blade.php :
 * coordonnées, localisation, articles, documents (catalogues, flyers…) et liens.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import {
  deleteProviderDocument,
  deleteProviderLink,
  downloadProviderDocument,
  getProvider,
  providerDocuments,
  saveProvider,
  saveProviderLink,
  updateProviderDocument,
  uploadProviderDocument,
} from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import ArticlesSection from '@/components/stock/ArticlesSection.vue'
import DocumentsManager from '@/components/erp/DocumentsManager.vue'
import LocationCard from '@/components/erp/LocationCard.vue'

const route = useRoute()
const id = computed(() => route.params.id)

const provider = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    provider.value = await getProvider(id.value)
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
  { name: 'Fournisseurs', to: { name: 'fournisseurs' } },
  { name: provider.value?.name || 'Fournisseur' },
])

const fields = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'phone', label: 'Téléphone', type: 'tel', col: 'col-md-6' },
  { name: 'email', label: 'E-mail', type: 'email', col: 'col-md-6' },
  { name: 'website', label: 'Site web', type: 'url' },
  { name: 'address', label: 'Adresse' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const formOpen = ref(false)
const logoOpen = ref(false)
async function onSaved() {
  formOpen.value = false
  logoOpen.value = false
  await load()
}

// ---------- Onglets ----------
const tab = ref('articles')
const documentsCount = ref(null)
watch(id, () => {
  tab.value = 'articles'
  documentsCount.value = null
})
const tabs = computed(() => [
  { key: 'articles', label: 'Articles', icon: 'ti-package', count: provider.value?.articles_count },
  { key: 'documents', label: 'Documents', icon: 'ti-files', count: documentsCount.value ?? provider.value?.documents?.length },
  { key: 'liens', label: 'Liens', icon: 'ti-link', count: provider.value?.links?.length },
])

// ---------- Localisation : enregistrée avec les autres champs du fournisseur ----------
const saveLocation = async (loc) => {
  const p = provider.value
  await saveProvider(
    { name: p.name, phone: p.phone, email: p.email, website: p.website, description: p.description, address: loc.address, latitude: loc.latitude, longitude: loc.longitude },
    p.id,
  )
  Object.assign(provider.value, loc)
}

// ---------- Liens ----------
const linkFields = [
  { name: 'name', label: 'Titre', required: true, placeholder: 'Catalogue en ligne' },
  { name: 'url', label: 'Adresse (URL)', type: 'url', required: true, placeholder: 'https://' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const linkOpen = ref(false)
const editingLink = ref(null)
function openLink(l = null) {
  editingLink.value = l
  linkOpen.value = true
}
const submitLink = (v) => saveProviderLink(provider.value.id, v, editingLink.value?.id)
async function onLinkSaved() {
  linkOpen.value = false
  await load()
}
async function removeLink(l) {
  if (!confirm(`Supprimer le lien « ${l.name} » ?`)) return
  try {
    await deleteProviderLink(l.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <PageHeader :title="provider ? `Fournisseur: ${provider.name}` : 'Fournisseur'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="provider" class="btn-list">
        <button class="btn" @click="logoOpen = true"><i class="ti ti-photo-edit"></i> Logo</button>
        <button class="btn btn-primary" @click="formOpen = true"><i class="ti ti-edit"></i> Modifier</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="provider" class="row g-3">
        <div class="col-md-4">
          <div class="card">
            <div class="card-body text-center">
              <img v-if="provider.logo_url" :src="provider.logo_url" :alt="provider.name" class="img-fluid rounded-2 mb-2" style="max-height: 120px" />
              <span v-else class="avatar avatar-xl rounded-2 mb-2"><i class="ti ti-building" style="font-size: 2rem"></i></span>
              <h2 class="m-0">{{ provider.name }}</h2>
              <div class="text-secondary">{{ provider.articles_count }} article(s)</div>
            </div>
            <div class="list-group list-group-flush">
              <a v-if="provider.phone" :href="`tel:${provider.phone}`" class="list-group-item list-group-item-action"><i class="ti ti-phone me-1"></i>{{ provider.phone }}</a>
              <a v-if="provider.email" :href="`mailto:${provider.email}`" class="list-group-item list-group-item-action"><i class="ti ti-mail me-1"></i>{{ provider.email }}</a>
              <a v-if="provider.website" :href="provider.website" target="_blank" rel="noopener" class="list-group-item list-group-item-action"><i class="ti ti-world me-1"></i>{{ provider.website }}</a>
              <div v-if="provider.description" class="list-group-item text-secondary description">{{ provider.description }}</div>
            </div>
          </div>

          <LocationCard
            class="mt-3"
            :address="provider.address || ''"
            :latitude="provider.latitude"
            :longitude="provider.longitude"
            :save="saveLocation"
          />
        </div>

        <div class="col-md-8">
          <nav class="nav nav-segmented w-100 mb-2 border" role="tablist">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="nav-link"
              :class="{ active: tab === t.key }"
              role="tab"
              :aria-selected="tab === t.key"
              @click="tab = t.key"
            >
              <i :class="['ti me-1', t.icon]"></i>{{ t.label }}
              <span v-if="t.count" class="badge bg-primary-lt ms-1">{{ t.count }}</span>
            </button>
          </nav>

          <ArticlesSection v-if="tab === 'articles'" :key="`provider-${id}`" :filter="{ provider_id: Number(id) }" col="col-xl-6" />

          <DocumentsManager
            v-else-if="tab === 'documents'"
            :key="`provider-docs-${id}`"
            :fetch="() => providerDocuments(provider.id)"
            :upload="(file, category) => uploadProviderDocument(provider.id, file, '', category)"
            :update="updateProviderDocument"
            :remove="(d) => deleteProviderDocument(d.id)"
            :download="downloadProviderDocument"
            @changed="(n) => (documentsCount = n)"
          />

          <div v-else-if="tab === 'liens'" class="card">
            <div class="card-header">
              <h3 class="card-title">Liens</h3>
              <button class="btn btn-primary btn-sm ms-auto" @click="openLink()"><i class="ti ti-plus"></i> Lien</button>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!provider.links?.length" class="list-group-item text-secondary">Aucun lien (catalogue en ligne, espace revendeur, documentation…)</div>
              <div v-for="l in provider.links" :key="l.id" class="list-group-item d-flex align-items-center gap-2 py-2">
                <i class="ti ti-link text-secondary"></i>
                <div class="min-w-0">
                  <a :href="l.url" target="_blank" rel="noopener" class="fw-medium">{{ l.name }}</a>
                  <span class="text-secondary small ms-1">{{ host(l.url) }}</span>
                  <div v-if="l.description" class="text-secondary small text-truncate">{{ l.description }}</div>
                </div>
                <div class="ms-auto btn-list flex-nowrap">
                  <button class="btn btn-sm btn-icon" title="Modifier" @click="openLink(l)"><i class="ti ti-edit"></i></button>
                  <button class="btn btn-sm btn-icon btn-ghost-danger" title="Supprimer" @click="removeLink(l)"><i class="ti ti-trash"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal :show="formOpen" title="Editer le fournisseur" :fields="fields" :initial="provider" :submit="(v) => saveProvider(v, provider.id)" @close="formOpen = false" @saved="onSaved" />
  <NamedFormModal
    :show="linkOpen"
    :title="editingLink ? 'Modifier le lien' : 'Ajouter un lien'"
    :fields="linkFields"
    :initial="editingLink"
    :submit="submitLink"
    @close="linkOpen = false"
    @saved="onLinkSaved"
  />
  <ImageUploadModal :show="logoOpen" title="Logo du fournisseur" :endpoint="provider ? `/providers/${provider.id}/logo` : ''" :current="provider?.logo_url" @close="logoOpen = false" @saved="onSaved" />
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
