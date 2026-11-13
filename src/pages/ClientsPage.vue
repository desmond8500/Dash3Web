<script setup>
import { onMounted, reactive, ref } from 'vue'
import api, { errorMessage } from '@/api/client'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'

const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/clients', { per_page: 12 })

onMounted(() => load(1))

// Création / modification
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({ id: null, name: '', description: '', address: '', type: '', status: '', favorite: 0 })

function openForm(client = null) {
  Object.assign(form, {
    id: client?.id ?? null,
    name: client?.name ?? '',
    description: client?.description ?? '',
    address: client?.address ?? '',
    type: client?.type ?? '',
    status: client?.status ?? '',
    favorite: client?.favorite ?? 0,
  })
  formError.value = ''
  showModal.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const payload = { ...form }
    delete payload.id
    if (form.id) await api.put(`/clients/${form.id}`, payload)
    else await api.post('/clients', payload)
    showModal.value = false
    await load()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

async function remove(client) {
  if (!confirm(`Supprimer le client « ${client.name} » ?`)) return
  try {
    await api.delete(`/clients/${client.id}`)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader title="Clients" pretitle="ERP">
    <template #actions>
      <button class="btn btn-primary" @click="openForm()"><i class="ti ti-plus me-1"></i>Nouveau client</button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 320px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Rechercher un client…" />
          </div>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Adresse</th>
                <th>Type</th>
                <th>Statut</th>
                <th class="w-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="text-center py-4"><div class="spinner-border text-secondary"></div></td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="5" class="text-center text-secondary py-4">Aucun client</td>
              </tr>
              <template v-else>
              <tr v-for="c in items" :key="c.id">
                <td>
                  <div class="d-flex align-items-center">
                    <span class="avatar avatar-sm me-2" :style="{ backgroundImage: `url(${c.avatar})` }"></span>
                    <div>
                      <RouterLink :to="{ name: 'projets', query: { client_id: c.id } }" class="fw-medium text-reset">
                        {{ c.name }}
                      </RouterLink>
                      <i v-if="c.favorite" class="ti ti-star-filled text-yellow ms-1"></i>
                      <div class="text-secondary small text-truncate" style="max-width: 280px">{{ c.description }}</div>
                    </div>
                  </div>
                </td>
                <td class="text-secondary">{{ c.address }}</td>
                <td>{{ c.type }}</td>
                <td><span v-if="c.status" class="badge bg-blue-lt">{{ c.status }}</span></td>
                <td>
                  <div class="btn-list flex-nowrap">
                    <button class="btn btn-icon btn-ghost-secondary" title="Modifier" @click="openForm(c)"><i class="ti ti-edit"></i></button>
                    <button class="btn btn-icon btn-ghost-danger" title="Supprimer" @click="remove(c)"><i class="ti ti-trash"></i></button>
                  </div>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>

        <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
      </div>
    </div>
  </div>

  <!-- Modale client (pilotée par Vue, sans le JS Bootstrap) -->
  <template v-if="showModal">
    <div class="modal modal-blur d-block" tabindex="-1" role="dialog" @click.self="showModal = false">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <form class="modal-content" @submit.prevent="save">
          <div class="modal-header">
            <h5 class="modal-title">{{ form.id ? 'Modifier le client' : 'Nouveau client' }}</h5>
            <button type="button" class="btn-close" aria-label="Fermer" @click="showModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
            <div class="mb-3">
              <label class="form-label required">Nom</label>
              <input v-model.trim="form.name" class="form-control" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Description</label>
              <textarea v-model="form.description" class="form-control" rows="2"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label">Adresse</label>
              <input v-model="form.address" class="form-control" />
            </div>
            <div class="row">
              <div class="col-6 mb-3">
                <label class="form-label">Type</label>
                <input v-model="form.type" class="form-control" />
              </div>
              <div class="col-6 mb-3">
                <label class="form-label">Statut</label>
                <input v-model="form.status" class="form-control" />
              </div>
            </div>
            <label class="form-check form-switch">
              <input v-model="form.favorite" class="form-check-input" type="checkbox" :true-value="1" :false-value="0" />
              <span class="form-check-label">Favori</span>
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-link link-secondary" @click="showModal = false">Annuler</button>
            <button type="submit" class="btn btn-primary ms-auto" :disabled="saving || !form.name">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal-backdrop fade show"></div>
  </template>
</template>
