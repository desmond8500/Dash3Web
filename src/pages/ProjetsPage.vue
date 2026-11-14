<script setup>
/**
 * Page Projets, reprise de livewire/erp/projets-page.blade.php :
 * carte du client à gauche (onglets Projets / Tâches / Contacts), cartes projets à droite.
 * Sans ?client_id, affiche tous les projets.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/client'
import {
  clientContacts,
  clientTasks,
  deleteProjet,
  getClient,
  toggleClientFavorite,
  toggleProjetFavorite,
} from '@/api/dash3'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import TaskList from '@/components/erp/TaskList.vue'
import ContactsGrid from '@/components/erp/ContactsGrid.vue'
import Pagination from '@/components/Pagination.vue'
import ProjetCard from '@/components/cards/ProjetCard.vue'
import ClientSideCard from '@/components/cards/ClientSideCard.vue'
import ProjetFormModal from '@/components/forms/ProjetFormModal.vue'
import ClientFormModal from '@/components/forms/ClientFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'

const route = useRoute()
const router = useRouter()
const clientId = computed(() => route.query.client_id || '')

const params = { per_page: 12 }
const list = usePaginatedList('/projets', params)
const { items, page, lastPage, total, search, loading, error } = list

function load(p = 1) {
  params.client_id = clientId.value || undefined
  return list.load(p)
}

// ---------- Client ----------
const client = ref(null)
const tab = ref('projets')
const tasks = ref([])
const tasksLoading = ref(false)

async function loadClient() {
  client.value = null
  if (!clientId.value) return
  try {
    client.value = await getClient(clientId.value)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function loadTasks() {
  tasksLoading.value = true
  try {
    tasks.value = await clientTasks(clientId.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    tasksLoading.value = false
  }
}

const contacts = ref([])
const contactsLoading = ref(false)
async function loadContacts() {
  contactsLoading.value = true
  try {
    contacts.value = await clientContacts(clientId.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    contactsLoading.value = false
  }
}

watch(tab, (t) => {
  if (!clientId.value) return
  if (t === 'taches') loadTasks()
  if (t === 'contacts') loadContacts()
})


async function init() {
  tab.value = 'projets'
  await Promise.all([load(1), loadClient()])
}
onMounted(init)
watch(clientId, init)

const breadcrumbs = computed(() => [
  { name: 'ERP' },
  { name: 'Clients', to: { name: 'clients' } },
  { name: client.value?.name || 'Projets' },
])

// ---------- Projets ----------
const projetFormOpen = ref(false)
const editingProjet = ref(null)
function openProjetForm(projet = null) {
  editingProjet.value = projet
  projetFormOpen.value = true
}
async function onProjetSaved() {
  projetFormOpen.value = false
  await Promise.all([load(page.value), loadClient()])
}
async function removeProjet(projet) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer le projet « ${projet.name} » ?`)) return
  try {
    await deleteProjet(projet.id)
    await Promise.all([load(page.value), loadClient()])
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function favoriteProjet(projet) {
  try {
    const { data } = await toggleProjetFavorite(projet.id)
    projet.favorite = data?.data?.favorite ?? !projet.favorite
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Client : édition, logo, favori ----------
const clientFormOpen = ref(false)
const logoOpen = ref(false)
async function onClientSaved() {
  clientFormOpen.value = false
  logoOpen.value = false
  await loadClient()
}
async function favoriteClient() {
  try {
    const { data } = await toggleClientFavorite(client.value.id)
    client.value.favorite = data?.data?.favorite ?? !client.value.favorite
  } catch (e) {
    error.value = errorMessage(e)
  }
}

</script>

<template>
  <PageHeader :title="client ? client.name : 'Projets'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div class="btn-list">
        <input v-model="search" type="search" class="form-control w-auto" placeholder="Rechercher" aria-label="Rechercher un projet" />
        <button v-if="clientId" class="btn btn-primary" @click="openProjetForm()"><i class="ti ti-plus"></i> Projet</button>
        <button v-if="client" class="btn btn-primary btn-icon" title="Modifier le client" @click="clientFormOpen = true"><i class="ti ti-edit"></i></button>
        <button v-if="clientId" class="btn btn-outline-secondary" title="Tous les projets" @click="router.push({ name: 'projets' })"><i class="ti ti-x"></i> Tous</button>
        <button class="btn btn-icon" title="Actualiser" @click="init"><i class="ti ti-reload"></i></button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="row g-2">
        <div v-if="clientId" class="col-md-3">
          <ClientSideCard
            v-if="client"
            :client="client"
            :tab="tab"
            @edit="clientFormOpen = true"
            @logo="logoOpen = true"
            @favorite="favoriteClient"
            @tab="tab = $event"
          />
          <div v-else class="card card-body placeholder-glow"><span class="placeholder col-12" style="height: 200px"></span></div>
        </div>

        <div :class="clientId ? 'col-md-9' : 'col-12'">
          <!-- Projets -->
          <template v-if="tab === 'projets'">
            <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
            <div v-else-if="!items.length" class="empty">
              <div class="empty-icon"><i class="ti ti-folder-off" style="font-size: 3rem"></i></div>
              <p class="empty-title">Aucun projet</p>
            </div>
            <template v-else>
              <div class="row row-deck g-2">
                <div v-for="p in items" :key="p.id" :class="clientId ? 'col-md-4' : 'col-md-3'">
                  <ProjetCard :projet="p" @edit="openProjetForm" @delete="removeProjet" @favorite="favoriteProjet" />
                </div>
              </div>
              <div class="card mt-2">
                <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
              </div>
            </template>
          </template>

          <!-- Tâches du client : fil d'Ariane client › projet › tâche -->
          <TaskList
            v-else-if="tab === 'taches'"
            :tasks="tasks"
            :loading="tasksLoading"
            :client="client"
            :defaults="{ client_id: client?.id }"
            @changed="loadTasks"
          />

          <!-- Contacts du client : ajout, édition, suppression -->
          <ContactsGrid v-else :contacts="contacts" :loading="contactsLoading" :defaults="{ client_id: client?.id }" col="col-md-4" @changed="loadContacts" />
        </div>
      </div>
    </div>
  </div>

  <ProjetFormModal :show="projetFormOpen" :projet="editingProjet" :client-id="clientId" @close="projetFormOpen = false" @saved="onProjetSaved" />
  <ClientFormModal :show="clientFormOpen" :client="client" @close="clientFormOpen = false" @saved="onClientSaved" />
  <ImageUploadModal
    :show="logoOpen"
    title="Éditer le logo du client"
    :endpoint="client ? `/clients/${client.id}/avatar` : ''"
    :current="client?.avatar"
    @close="logoOpen = false"
    @saved="onClientSaved"
  />
</template>
