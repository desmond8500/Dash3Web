<script setup>
/**
 * Contacts d'un projet ou d'un client : cartes avec ajout, édition et suppression.
 * `defaults` fixe le rattachement à la création : { projet_id } ou { client_id }.
 */
import { ref } from 'vue'
import { errorMessage } from '@/api/client'
import { deleteContact, saveContact } from '@/api/dash3'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const props = defineProps({
  contacts: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  defaults: { type: Object, required: true },
  col: { type: String, default: 'col-md-6' },
})
const emit = defineEmits(['changed'])
const error = ref('')

const contactName = (c) => [c.firstname, c.lastname].filter(Boolean).join(' ') || c.societe || '—'

const fields = [
  { name: 'firstname', label: 'Prénom', required: true, col: 'col-md-6' },
  { name: 'lastname', label: 'Nom', col: 'col-md-6' },
  { name: 'fonction', label: 'Fonction', col: 'col-md-6' },
  { name: 'societe', label: 'Société', col: 'col-md-6' },
  { name: 'phone', label: 'Téléphone', type: 'tel', col: 'col-md-6' },
  { name: 'email', label: 'Email', type: 'email', col: 'col-md-6' },
]
const open = ref(false)
const editing = ref(null)
function edit(c = null) {
  editing.value = c
  open.value = true
}
const submit = (v) => saveContact(editing.value ? v : { ...props.defaults, ...v }, editing.value?.id)
function onSaved() {
  open.value = false
  emit('changed')
}
async function remove(c) {
  if (!confirm(`Supprimer le contact « ${contactName(c)} » ?`)) return
  try {
    await deleteContact(c.id)
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <div class="border border-primary p-2 rounded">
    <div class="d-flex align-items-center mb-2">
      <h3 class="card-title m-0 ps-1">Contacts</h3>
      <button class="btn btn-primary btn-sm ms-auto" @click="edit()"><i class="ti ti-plus"></i> Contact</button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="loading" class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>
    <div v-else-if="!contacts.length" class="text-secondary p-2">Aucun contact</div>
    <div class="row g-2">
      <div v-for="c in contacts" :key="c.id" :class="col">
        <div class="card card-sm h-100">
          <div class="card-body d-flex gap-2">
            <span class="avatar rounded-2" :style="c.avatar ? { backgroundImage: `url(${c.avatar})` } : null">
              <i v-if="!c.avatar" class="ti ti-user"></i>
            </span>
            <div class="min-w-0 flex-fill">
              <div class="fw-bold">{{ contactName(c) }}</div>
              <div class="text-secondary small">{{ [c.fonction, c.societe].filter(Boolean).join(' · ') }}</div>
              <div class="small mt-1">
                <div v-if="c.phone"><a :href="`tel:${c.phone}`"><i class="ti ti-phone"></i>{{ c.phone }}</a></div>
                <div v-if="c.email" class="text-truncate"><a :href="`mailto:${c.email}`"><i class="ti ti-mail"></i>{{ c.email }}</a></div>
              </div>
            </div>
            <div class="dropdown">
              <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
              <div class="dropdown-menu dropdown-menu-end">
                <button class="dropdown-item" type="button" @click="edit(c)"><i class="ti ti-edit me-1"></i> Éditer</button>
                <button class="dropdown-item text-danger" type="button" @click="remove(c)"><i class="ti ti-trash me-1"></i> Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="open"
    :title="editing ? 'Modifier le contact' : 'Ajouter un contact'"
    :fields="fields"
    :initial="editing"
    :submit="submit"
    @close="open = false"
    @saved="onSaved"
  />
</template>
