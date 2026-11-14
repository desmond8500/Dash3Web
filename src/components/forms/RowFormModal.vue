<script setup>
/** Ligne de devis : depuis un article du stock (recherche) ou saisie libre ; modification. */
import { reactive, ref, watch } from 'vue'
import api, { errorMessage, normalizeList } from '@/api/client'
import { PRIORITIES, saveRow } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  sectionId: { type: Number, default: null },
  row: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const mode = ref('article') // article | libre
const form = reactive({ designation: '', reference: '', quantite: 1, coef: 1, prix: 0, priorite_id: 1, comment: '', article_id: null })
const saving = ref(false)
const error = ref('')

// Recherche d'articles
const search = ref('')
const results = ref([])
const searching = ref(false)
let timer
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (!q.trim()) return (results.value = [])
    searching.value = true
    try {
      const { data } = await api.get('/items', { params: { search: q.trim(), per_page: 10 } })
      results.value = normalizeList(data).items
    } finally {
      searching.value = false
    }
  }, 300)
})

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const r = props.row
    mode.value = r ? 'libre' : 'article'
    Object.assign(form, {
      designation: r?.designation ?? '',
      reference: r?.reference && r.reference !== '_' ? r.reference : '',
      quantite: r?.quantite ?? 1,
      coef: r?.coef ?? 1,
      prix: r?.prix ?? 0,
      priorite_id: r?.priorite_id ?? 1,
      comment: r?.comment ?? '',
      article_id: r?.article_id ?? null,
    })
    search.value = ''
    results.value = []
    error.value = ''
  },
)

function chooseArticle(a) {
  Object.assign(form, {
    article_id: a.id,
    designation: a.designation,
    reference: a.reference ?? '',
    prix: a.price ?? 0,
    priorite_id: a.priority_id ?? 1,
  })
  mode.value = 'libre' // on affiche le formulaire pré-rempli pour ajuster quantité / coef
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      ...form,
      designation: form.designation.trim(),
      reference: form.reference.trim() || null,
      quantite: Math.max(0, Math.trunc(Number(form.quantite) || 0)),
      coef: Number(form.coef) || 0,
      prix: Number(form.prix) || 0,
      comment: form.comment.trim() || null,
    }
    if (!props.row) payload.invoice_section_id = props.sectionId
    await saveRow(payload, props.row?.id)
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :show="show"
    :title="row ? 'Modifier la ligne' : 'Ajouter un article'"
    size="modal-lg"
    :saving="saving"
    :can-submit="mode === 'libre' && !!form.designation.trim()"
    :error="error"
    @close="emit('close')"
    @submit="submit"
  >
    <ul v-if="!row" class="nav nav-segmented w-100 mb-3">
      <li class="nav-item flex-fill"><button type="button" class="nav-link w-100" :class="{ active: mode === 'article' }" @click="mode = 'article'">Depuis le stock</button></li>
      <li class="nav-item flex-fill"><button type="button" class="nav-link w-100" :class="{ active: mode === 'libre' }" @click="mode = 'libre'">Ligne libre / détails</button></li>
    </ul>

    <template v-if="mode === 'article'">
      <input v-model="search" type="search" class="form-control mb-2" placeholder="Désignation ou référence…" />
      <div v-if="searching" class="text-center py-2"><div class="spinner-border spinner-border-sm"></div></div>
      <div class="list-group">
        <button v-for="a in results" :key="a.id" type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" @click="chooseArticle(a)">
          <img :src="a.image" alt="" class="avatar avatar-sm rounded-2" style="object-fit: contain" />
          <div class="min-w-0">
            <div class="fw-medium text-truncate">{{ a.designation }}</div>
            <div class="text-secondary small">{{ a.reference }} · {{ a.priority }}</div>
          </div>
          <div class="ms-auto text-nowrap">{{ new Intl.NumberFormat('fr-FR').format(a.price || 0) }} F</div>
        </button>
      </div>
    </template>

    <div v-else class="row">
      <div v-if="form.article_id" class="col-12 mb-2 small text-secondary"><i class="ti ti-link"></i> Lié à l'article du stock n° {{ form.article_id }}</div>
      <div class="col-md-8 mb-3">
        <label class="form-label required">Désignation</label>
        <input v-model="form.designation" class="form-control" required />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Priorité</label>
        <select v-model.number="form.priorite_id" class="form-select">
          <option v-for="p in PRIORITIES" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="col-12 mb-3">
        <label class="form-label">Référence</label>
        <textarea v-model="form.reference" class="form-control" rows="2"></textarea>
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Quantité</label>
        <input v-model="form.quantite" type="number" min="0" step="1" class="form-control" />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Coef</label>
        <input v-model="form.coef" type="number" min="0" step="0.05" class="form-control" />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Prix (F)</label>
        <input v-model="form.prix" type="number" min="0" step="any" class="form-control" />
      </div>
      <div class="col-12">
        <label class="form-label">Commentaire</label>
        <textarea v-model="form.comment" class="form-control" rows="2"></textarea>
      </div>
    </div>
  </AppModal>
</template>
