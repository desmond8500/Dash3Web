<script setup>
/** Page Clients, reprise de livewire/erp/clients-page.blade.php : grille de cartes. */
import { onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { deleteClient, toggleClientFavorite } from '@/api/dash3'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import ClientCard from '@/components/cards/ClientCard.vue'
import ClientFormModal from '@/components/forms/ClientFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'

const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/clients', { per_page: 12 })
onMounted(() => load(1))

const formOpen = ref(false)
const editing = ref(null)
const logoOpen = ref(false)
const logoClient = ref(null)

function openForm(client = null) {
  editing.value = client
  formOpen.value = true
}
async function onSaved() {
  formOpen.value = false
  await load()
}

function openLogo(client) {
  logoClient.value = client
  logoOpen.value = true
}
async function onLogoSaved() {
  logoOpen.value = false
  await load()
}

async function remove(client) {
  if (!confirm(`Supprimer le client « ${client.name} » ?`)) return
  try {
    await deleteClient(client.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function favorite(client) {
  try {
    const { data } = await toggleClientFavorite(client.id)
    client.favorite = data?.data?.favorite ?? !client.favorite
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader title="Clients">
    <template #actions>
      <div class="btn-list">
        <input v-model="search" type="search" class="form-control w-auto" placeholder="Trouver un client" aria-label="Trouver un client" />
        <button type="button" class="btn btn-primary" title="Ajouter un client" @click="openForm()">
          <i class="ti ti-plus me-2"></i>Client
        </button>
        <button type="button" class="btn btn-icon" title="Actualiser" @click="load()"><i class="ti ti-reload"></i></button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>

      <div v-else-if="!items.length" class="empty">
        <div class="empty-icon"><i class="ti ti-mood-empty" style="font-size: 3rem"></i></div>
        <p class="empty-title">Pas de client trouvé</p>
        <p class="empty-subtitle text-secondary">Ajoutez de nouveaux clients ou changez de critères de recherche.</p>
        <div class="empty-action">
          <button class="btn btn-primary" @click="search = ''"><i class="ti ti-mood-empty"></i>Rechercher de nouveau</button>
        </div>
      </div>

      <template v-else>
        <div class="row row-deck g-2">
          <div v-for="c in items" :key="c.id" class="col-md-4">
            <ClientCard :client="c" @edit="openForm" @delete="remove" @favorite="favorite" @logo="openLogo" />
          </div>
        </div>
        <div class="card mt-3">
          <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
        </div>
      </template>
    </div>
  </div>

  <ClientFormModal :show="formOpen" :client="editing" @close="formOpen = false" @saved="onSaved" />
  <ImageUploadModal
    :show="logoOpen"
    title="Éditer le logo du client"
    :endpoint="logoClient ? `/clients/${logoClient.id}/avatar` : ''"
    :current="logoClient?.avatar"
    @close="logoOpen = false"
    @saved="onLogoSaved"
  />
</template>
