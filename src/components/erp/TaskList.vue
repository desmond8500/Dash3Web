<script setup>
/**
 * Liste de tâches partagée (page Projet, page Projets, page Tâches).
 * Petit fil d'Ariane au-dessus de chaque tâche : Client › Projet › Tâche,
 * avec ajout, édition, changement de statut et suppression.
 */
import { computed, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { TASK_STATUTS, deleteTask, formatDate, saveTask } from '@/api/dash3'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  /** Valeurs imposées à la création : { projet_id, client_id } */
  defaults: { type: Object, default: () => ({}) },
  /** Projet / client connus quand les tâches ne les embarquent pas */
  projet: { type: Object, default: null },
  client: { type: Object, default: null },
  title: { type: String, default: 'Tâches' },
  addable: { type: Boolean, default: true },
  flush: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])
const error = ref('')

const statusBadge = (s) => ({ 1: 'bg-primary', 2: 'bg-warning', 3: 'bg-secondary', 4: 'bg-success', 5: 'bg-dark' })[s] || 'bg-secondary'
const statusName = (s) => TASK_STATUTS.find((x) => x.value === Number(s))?.label || '—'
const isLate = (t) => t.expiration_date && Number(t.statut_id) < 4 && new Date(t.expiration_date) < new Date()

const crumbs = (t) => {
  const p = t.projet || (props.projet && (!t.projet_id || t.projet_id === props.projet.id) ? props.projet : null)
  const c = t.client || props.client
  return [
    c ? { name: c.name, to: { name: 'projets', query: { client_id: c.id } } } : null,
    p ? { name: p.name, to: { name: 'projet', params: { id: p.id } } } : null,
  ].filter(Boolean)
}

// ---------- Formulaire ----------
const fields = [
  { name: 'name', label: 'Tâche', required: true, placeholder: 'Nom de la tâche' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'statut_id', label: 'Statut', type: 'select', options: TASK_STATUTS, required: true, default: 1, col: 'col-md-6' },
  { name: 'expiration_date', label: 'Échéance', type: 'date', col: 'col-md-6' },
]
const open = ref(false)
const editing = ref(null)
const initial = computed(() => editing.value)
function edit(t = null) {
  editing.value = t
  open.value = true
}
const submit = (v) => saveTask(editing.value ? v : { ...props.defaults, ...v }, editing.value?.id)
function onSaved() {
  open.value = false
  emit('changed')
}

async function setStatut(t, statut) {
  try {
    await saveTask({ statut_id: statut }, t.id)
    t.statut_id = statut
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function remove(t) {
  if (!confirm(`Supprimer la tâche « ${t.name} » ?`)) return
  try {
    await deleteTask(t.id)
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e)
  }
}
defineExpose({ edit })
</script>

<template>
  <div :class="flush ? '' : 'card'">
    <div v-if="!flush" class="card-header">
      <h3 class="card-title">{{ title }}</h3>
      <button v-if="addable" class="btn btn-primary btn-sm ms-auto" @click="edit()"><i class="ti ti-plus"></i> Tâche</button>
    </div>
    <div v-if="error" class="alert alert-danger m-2">{{ error }}</div>
    <div class="list-group list-group-flush">
      <div v-if="loading" class="list-group-item text-center"><div class="spinner-border spinner-border-sm"></div></div>
      <div v-else-if="!tasks.length" class="list-group-item text-secondary">Aucune tâche</div>
      <div v-for="t in tasks" v-else :key="t.id" class="list-group-item">
        <!-- Fil d'Ariane : client › projet › tâche -->
        <ol class="breadcrumb breadcrumb-arrows small mb-1">
          <li v-for="(c, i) in crumbs(t)" :key="i" class="breadcrumb-item"><RouterLink :to="c.to">{{ c.name }}</RouterLink></li>
          <li class="breadcrumb-item active"><a href="#" @click.prevent="edit(t)">Tâche</a></li>
        </ol>
        <div class="row align-items-center g-2">
          <div class="col min-w-0">
            <a href="#" class="fw-medium text-reset" @click.prevent="edit(t)">{{ t.name }}</a>
            <div v-if="t.description" class="text-secondary small text-truncate">{{ t.description }}</div>
          </div>
          <div class="col-auto small" :class="isLate(t) ? 'text-danger' : 'text-secondary'">{{ formatDate(t.expiration_date) }}</div>
          <div class="col-auto dropdown">
            <button class="badge text-white border-0" :class="statusBadge(t.statut_id)" data-bs-toggle="dropdown" type="button">
              {{ statusName(t.statut_id) }}
            </button>
            <div class="dropdown-menu dropdown-menu-end">
              <button v-for="s in TASK_STATUTS" :key="s.value" class="dropdown-item" type="button" @click="setStatut(t, s.value)">
                <span class="badge me-2" :class="statusBadge(s.value)"></span>{{ s.label }}
              </button>
            </div>
          </div>
          <div class="col-auto dropdown">
            <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
            <div class="dropdown-menu dropdown-menu-end">
              <button class="dropdown-item" type="button" @click="edit(t)"><i class="ti ti-edit me-1"></i> Éditer</button>
              <button class="dropdown-item text-danger" type="button" @click="remove(t)"><i class="ti ti-trash me-1"></i> Supprimer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="open"
    :title="editing ? 'Modifier la tâche' : 'Ajouter une tâche'"
    :fields="fields"
    :initial="initial"
    :submit="submit"
    @close="open = false"
    @saved="onSaved"
  />
</template>
