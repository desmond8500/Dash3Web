<script setup>
/** Page Fournisseur, reprise de livewire/stock/provider-page.blade.php : coordonnées et articles. */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import { getProvider, saveProvider } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import ArticlesSection from '@/components/stock/ArticlesSection.vue'

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
              <div v-if="provider.address" class="list-group-item"><i class="ti ti-map-pin me-1"></i>{{ provider.address }}</div>
              <div v-if="provider.description" class="list-group-item text-secondary description">{{ provider.description }}</div>
            </div>
          </div>
        </div>

        <div class="col-md-8">
          <ArticlesSection :key="`provider-${id}`" :filter="{ provider_id: Number(id) }" col="col-xl-6" />
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal :show="formOpen" title="Editer le fournisseur" :fields="fields" :initial="provider" :submit="(v) => saveProvider(v, provider.id)" @close="formOpen = false" @saved="onSaved" />
  <ImageUploadModal :show="logoOpen" title="Logo du fournisseur" :endpoint="provider ? `/providers/${provider.id}/logo` : ''" :current="provider?.logo_url" @close="logoOpen = false" @saved="onSaved" />
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
