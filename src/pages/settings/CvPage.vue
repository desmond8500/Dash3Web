<script setup>
import { cssUrl } from '@/utils/cssUrl'
/**
 * Page de détail d'un CV : contenu (coordonnées, accroche, sections et lignes)
 * à gauche, aperçu personnalisable à droite (couleur, police, mise en page).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/client'
import {
  CV_SECTION_TYPES,
  deleteCvItem,
  deleteCvSection,
  duplicateCv,
  getCv,
  saveCv,
  saveCvItem,
  saveCvSection,
} from '@/api/dash3'
import { renderMarkdown } from '@/utils/markdown'
import PageHeader from '@/components/PageHeader.vue'
import AppModal from '@/components/AppModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import MarkdownEditor from '@/components/erp/MarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id)

const cv = ref(null)
const photoBroken = ref(false)
const loading = ref(true)
const error = ref('')
const saved = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    cv.value = await getCv(id.value)
    photoBroken.value = false
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(id, load)

const breadcrumbs = computed(() => [
  { name: 'Paramètres' },
  { name: 'Mes CV', to: { name: 'cvs' } },
  { name: cv.value?.name || 'CV' },
])

/** Enregistrement d'un champ du CV, avec un court message de confirmation */
async function patch(payload) {
  try {
    await saveCv(payload, cv.value.id)
    Object.assign(cv.value, payload)
    saved.value = 'Enregistré'
    setTimeout(() => (saved.value = ''), 1500)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Informations ----------
const infoFields = [
  { name: 'name', label: 'Nom du CV', required: true, col: 'col-md-6' },
  { name: 'title', label: 'Intitulé du poste', placeholder: 'Technicien en sécurité électronique', col: 'col-md-6' },
  { name: 'fullname', label: 'Nom complet', col: 'col-md-6' },
  { name: 'phone', label: 'Téléphone', type: 'tel', col: 'col-md-6' },
  { name: 'email', label: 'E-mail', type: 'email', col: 'col-md-6' },
  { name: 'website', label: 'Site web', col: 'col-md-6' },
  { name: 'address', label: 'Adresse' },
]
const infoOpen = ref(false)
const photoOpen = ref(false)
async function onInfoSaved() {
  infoOpen.value = false
  photoOpen.value = false
  await load()
}

// ---------- Accroche ----------
const summaryOpen = ref(false)
const summaryDraft = ref('')
const summarySaving = ref(false)
function openSummary() {
  summaryDraft.value = cv.value.summary ?? ''
  summaryOpen.value = true
}
async function saveSummary() {
  summarySaving.value = true
  await patch({ summary: summaryDraft.value })
  summarySaving.value = false
  summaryOpen.value = false
}

// ---------- Personnalisation ----------
const FONTS = [
  { value: 'sans', label: 'Sans empattement' },
  { value: 'serif', label: 'Avec empattements' },
  { value: 'mono', label: 'Chasse fixe' },
]
const COLORS = ['#1690b7', '#206bc4', '#0ca678', '#ae3ec9', '#d6336c', '#f76707', '#1d273b']
const fontFamily = computed(
  () =>
    ({
      serif: 'Georgia, "Times New Roman", serif',
      mono: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
    })[cv.value?.font] || 'inherit',
)
const twoColumns = computed(() => cv.value?.layout === 'deux_colonnes')
const accent = computed(() => cv.value?.accent_color || '#1690b7')

// ---------- Sections ----------
const typeLabel = (type) => CV_SECTION_TYPES.find((t) => t.value === type)?.label ?? ''
const sectionOpen = ref(false)
const editingSection = ref(null)
const sectionForm = ref({ name: '', type: 'libre' })
const sectionSaving = ref(false)
const sectionError = ref('')
function openSection(s = null) {
  editingSection.value = s
  const type = s?.type || 'experience'
  sectionForm.value = { name: s?.name ?? typeLabel(type), type }
  sectionError.value = ''
  sectionOpen.value = true
}
/** Changement de type : le titre suit, sauf s'il a été personnalisé */
function onSectionType(type) {
  const previous = typeLabel(sectionForm.value.type)
  const name = sectionForm.value.name.trim()
  if (!name || name === previous) sectionForm.value.name = typeLabel(type)
  sectionForm.value.type = type
}
async function submitSection() {
  const payload = { name: sectionForm.value.name.trim(), type: sectionForm.value.type }
  if (!payload.name) return
  sectionSaving.value = true
  sectionError.value = ''
  try {
    await saveCvSection(
      editingSection.value ? payload : { ...payload, c_v_id: cv.value.id, order: cv.value.sections.length },
      editingSection.value?.id,
    )
    sectionOpen.value = false
    await load()
  } catch (e) {
    sectionError.value = errorMessage(e)
  } finally {
    sectionSaving.value = false
  }
}
async function removeSection(s) {
  if (!confirm(`Supprimer la section « ${s.name} » et son contenu ?`)) return
  try {
    await deleteCvSection(s.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function moveSection(s, delta) {
  const list = cv.value.sections
  const i = list.indexOf(s)
  const j = i + delta
  if (j < 0 || j >= list.length) return
  try {
    await Promise.all([saveCvSection({ order: j }, s.id), saveCvSection({ order: i }, list[j].id)])
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Lignes ----------
const itemOpen = ref(false)
const itemSection = ref(null)
const editingItem = ref(null)
const itemForm = ref({})
const itemSaving = ref(false)
const itemError = ref('')
const isSkill = computed(() => ['competence', 'langue'].includes(itemSection.value?.type))

function openItem(section, item = null) {
  itemSection.value = section
  editingItem.value = item
  itemForm.value = {
    title: item?.title ?? '',
    subtitle: item?.subtitle ?? '',
    place: item?.place ?? '',
    start_date: item?.start_date ?? '',
    end_date: item?.end_date ?? '',
    current: item?.current ?? false,
    description: item?.description ?? '',
    level: item?.level ?? 3,
  }
  itemError.value = ''
  itemOpen.value = true
}
async function submitItem() {
  const f = itemForm.value
  if (!f.title.trim()) return
  itemSaving.value = true
  itemError.value = ''
  try {
    const payload = {
      title: f.title.trim(),
      subtitle: f.subtitle || null,
      place: f.place || null,
      start_date: f.start_date || null,
      end_date: f.current ? null : f.end_date || null,
      current: !!f.current,
      description: f.description || null,
      level: isSkill.value ? Number(f.level) || null : null,
    }
    await saveCvItem(
      editingItem.value ? payload : { ...payload, cv_section_id: itemSection.value.id, order: itemSection.value.items.length },
      editingItem.value?.id,
    )
    itemOpen.value = false
    await load()
  } catch (e) {
    itemError.value = errorMessage(e)
  } finally {
    itemSaving.value = false
  }
}
async function removeItem(item) {
  if (!confirm(`Supprimer « ${item.title} » ?`)) return
  try {
    await deleteCvItem(item.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const period = (i) => {
  if (i.current) return `${i.start_date || ''} — aujourd'hui`.trim()
  return [i.start_date, i.end_date].filter(Boolean).join(' — ')
}
const duplicating = ref(false)
async function duplicate() {
  duplicating.value = true
  try {
    const copy = await duplicateCv(cv.value.id)
    if (copy?.id) router.push({ name: 'cv', params: { id: copy.id } })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    duplicating.value = false
  }
}

/** Impression (ou enregistrement en PDF) : seul l'aperçu est imprimé, voir styles.css */
const printCv = () => window.print()

const typeIcon = (type) => CV_SECTION_TYPES.find((t) => t.value === type)?.icon || 'ti-list'
const sideTypes = ['competence', 'langue']
const mainSections = computed(() => (cv.value?.sections ?? []).filter((s) => !twoColumns.value || !sideTypes.includes(s.type)))
const sideSections = computed(() => (twoColumns.value ? (cv.value?.sections ?? []).filter((s) => sideTypes.includes(s.type)) : []))
</script>

<template>
  <PageHeader :title="cv ? cv.name : 'CV'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="cv" class="btn-list align-items-center">
        <span v-if="saved" class="text-green small"><i class="ti ti-check"></i> {{ saved }}</span>
        <button class="btn" :disabled="duplicating" title="Créer une copie de ce CV" @click="duplicate">
          <span v-if="duplicating" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-copy"></i> Dupliquer
        </button>
        <button class="btn" @click="photoOpen = true"><i class="ti ti-photo"></i> Photo</button>
        <button class="btn btn-primary" @click="infoOpen = true"><i class="ti ti-edit"></i> Informations</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="cv" class="row g-3">
        <!-- Contenu -->
        <div class="col-lg-5 cv-editor">
          <!-- Personnalisation -->
          <div class="card mb-3">
            <div class="card-header"><h3 class="card-title"><i class="ti ti-palette text-primary"></i>Personnalisation</h3></div>
            <div class="card-body">
              <label class="form-label">Couleur d'accent</label>
              <div class="d-flex align-items-center gap-2 mb-3">
                <button
                  v-for="c in COLORS"
                  :key="c"
                  class="color-dot"
                  :class="{ active: accent.toLowerCase() === c }"
                  :style="{ background: c }"
                  :title="c"
                  @click="patch({ accent_color: c })"
                ></button>
                <input
                  type="color"
                  class="form-control form-control-color ms-1"
                  :value="accent"
                  title="Autre couleur"
                  @change="patch({ accent_color: $event.target.value })"
                />
              </div>

              <div class="row g-2">
                <div class="col-md-6">
                  <label class="form-label">Police</label>
                  <select class="form-select" :value="cv.font" @change="patch({ font: $event.target.value })">
                    <option v-for="f in FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Mise en page</label>
                  <select class="form-select" :value="cv.layout" @change="patch({ layout: $event.target.value })">
                    <option value="une_colonne">Une colonne</option>
                    <option value="deux_colonnes">Deux colonnes</option>
                  </select>
                </div>
              </div>

              <label class="form-check form-switch mt-3 mb-0">
                <input class="form-check-input" type="checkbox" :checked="cv.show_photo" @change="patch({ show_photo: $event.target.checked })" />
                <span class="form-check-label">Afficher la photo</span>
              </label>
            </div>
          </div>

          <!-- Accroche -->
          <div class="card mb-3">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-quote text-primary"></i>Accroche</h3>
              <button class="btn btn-sm btn-ghost-primary ms-auto" @click="openSummary"><i class="ti ti-edit"></i> Modifier</button>
            </div>
            <div class="card-body">
              <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown échappe le texte -->
              <div v-if="cv.summary" v-html="renderMarkdown(cv.summary)"></div>
              <div v-else class="text-secondary">Aucune accroche. Présentez-vous en quelques lignes.</div>
            </div>
          </div>

          <!-- Sections -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-list-details text-primary"></i>Sections</h3>
              <button class="btn btn-sm btn-primary ms-auto" @click="openSection()"><i class="ti ti-plus"></i> Section</button>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!cv.sections?.length" class="list-group-item text-secondary">Aucune section.</div>
              <div v-for="(s, i) in cv.sections" :key="s.id" class="list-group-item">
                <div class="d-flex align-items-center">
                  <i :class="['ti me-1 text-secondary', typeIcon(s.type)]"></i>
                  <span class="fw-medium">{{ s.name }}</span>
                  <span class="badge bg-secondary-lt ms-2">{{ s.items?.length || 0 }}</span>
                  <div class="ms-auto btn-list flex-nowrap">
                    <button class="btn btn-sm btn-icon" title="Monter" :disabled="i === 0" @click="moveSection(s, -1)"><i class="ti ti-arrow-up"></i></button>
                    <button class="btn btn-sm btn-icon" title="Descendre" :disabled="i === cv.sections.length - 1" @click="moveSection(s, 1)">
                      <i class="ti ti-arrow-down"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-ghost-primary" title="Ajouter une ligne" @click="openItem(s)"><i class="ti ti-plus"></i></button>
                    <div class="dropdown">
                      <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                      <div class="dropdown-menu dropdown-menu-end">
                        <button class="dropdown-item" type="button" @click="openSection(s)"><i class="ti ti-edit me-1"></i> Renommer</button>
                        <button class="dropdown-item text-danger" type="button" @click="removeSection(s)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-for="item in s.items" :key="item.id" class="cv-item d-flex align-items-center">
                  <div class="min-w-0">
                    <div class="text-truncate">
                      {{ item.title }}
                      <span v-if="item.subtitle" class="text-secondary small">— {{ item.subtitle }}</span>
                    </div>
                    <div class="text-secondary small">
                      {{ period(item) }}
                      <span v-if="item.level">· niveau {{ item.level }}/5</span>
                    </div>
                  </div>
                  <div class="ms-auto btn-list flex-nowrap">
                    <button class="btn btn-sm btn-icon" title="Modifier" @click="openItem(s, item)"><i class="ti ti-edit"></i></button>
                    <button class="btn btn-sm btn-icon btn-ghost-danger" title="Supprimer" @click="removeItem(item)"><i class="ti ti-trash"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Aperçu -->
        <div class="col-lg-7 cv-print">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-eye text-primary"></i>Aperçu</h3>
              <button class="btn btn-sm ms-auto" title="Imprimer ou enregistrer en PDF" @click="printCv">
                <i class="ti ti-printer"></i> Imprimer
              </button>
            </div>
            <div class="card-body cv-preview" :style="{ fontFamily }">
              <!-- En-tête -->
              <div class="d-flex gap-3 pb-2 mb-3" :style="{ borderBottom: `3px solid ${accent}` }">
                <template v-if="cv.show_photo">
                  <!-- <img> plutôt qu'une image de fond : elle reste visible à l'impression / en PDF -->
                  <img v-if="cv.photo_url && !photoBroken" :src="cv.photo_url" alt="" class="cv-photo rounded" @error="photoBroken = true" />
                  <span v-else class="avatar avatar-xl rounded" :title="photoBroken ? 'Photo introuvable sur le serveur' : ''">
                    <i :class="['ti', photoBroken ? 'ti-photo-off' : 'ti-user']" style="font-size: 2rem"></i>
                  </span>
                </template>
                <div class="min-w-0">
                  <div class="h1 m-0">{{ cv.fullname || cv.name }}</div>
                  <div v-if="cv.title" class="h3 m-0" :style="{ color: accent }">{{ cv.title }}</div>
                  <div class="text-secondary small mt-1">
                    <span v-if="cv.phone" class="me-2"><i class="ti ti-phone"></i> {{ cv.phone }}</span>
                    <span v-if="cv.email" class="me-2"><i class="ti ti-mail"></i> {{ cv.email }}</span>
                    <span v-if="cv.address" class="me-2"><i class="ti ti-map-pin"></i> {{ cv.address }}</span>
                    <span v-if="cv.website"><i class="ti ti-world"></i> {{ cv.website }}</span>
                  </div>
                </div>
              </div>

              <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown échappe le texte -->
              <div v-if="cv.summary" class="mb-3" v-html="renderMarkdown(cv.summary)"></div>

              <div class="row g-3">
                <div :class="twoColumns ? 'col-8' : 'col-12'">
                  <section v-for="s in mainSections" :key="s.id" class="mb-3">
                    <h4 class="cv-section-title" :style="{ color: accent, borderColor: accent }">{{ s.name }}</h4>
                    <div v-if="!s.items?.length" class="text-secondary small">—</div>
                    <div v-for="item in s.items" :key="item.id" class="mb-2">
                      <div class="d-flex">
                        <b>{{ item.title }}</b>
                        <span class="ms-auto text-secondary small text-nowrap">{{ period(item) }}</span>
                      </div>
                      <div v-if="item.subtitle || item.place" class="text-secondary small">
                        {{ [item.subtitle, item.place].filter(Boolean).join(' · ') }}
                      </div>
                      <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown échappe le texte -->
                      <div v-if="item.description" class="small" v-html="renderMarkdown(item.description)"></div>
                    </div>
                  </section>
                </div>

                <div v-if="twoColumns" class="col-4">
                  <section v-for="s in sideSections" :key="s.id" class="mb-3">
                    <h4 class="cv-section-title" :style="{ color: accent, borderColor: accent }">{{ s.name }}</h4>
                    <div v-if="!s.items?.length" class="text-secondary small">—</div>
                    <div v-for="item in s.items" :key="item.id" class="mb-2">
                      <div class="d-flex">
                        <span>{{ item.title }}</span>
                        <span v-if="item.level" class="ms-auto">
                          <i
                            v-for="n in 5"
                            :key="n"
                            class="ti ti-circle-filled"
                            :style="{ fontSize: '8px', color: n <= item.level ? accent : 'var(--tblr-border-color)' }"
                          ></i>
                        </span>
                      </div>
                      <div v-if="item.subtitle" class="text-secondary small">{{ item.subtitle }}</div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="infoOpen"
    title="Informations du CV"
    :fields="infoFields"
    :initial="cv"
    :submit="(v) => saveCv(v, cv.id)"
    @close="infoOpen = false"
    @saved="onInfoSaved"
  />

  <ImageUploadModal
    :show="photoOpen"
    title="Photo du CV"
    :endpoint="cv ? `/cvs/${cv.id}/photo` : ''"
    :current="cv?.photo_url"
    @close="photoOpen = false"
    @saved="onInfoSaved"
  />

  <AppModal
    :show="summaryOpen"
    title="Accroche"
    size="modal-lg"
    :saving="summarySaving"
    @close="summaryOpen = false"
    @submit="saveSummary"
  >
    <MarkdownEditor v-model="summaryDraft" :rows="8" placeholder="Technicien avec 8 ans d'expérience…" />
  </AppModal>

  <AppModal
    :show="sectionOpen"
    :title="editingSection ? 'Modifier la section' : 'Ajouter une section'"
    :saving="sectionSaving"
    :can-submit="!!sectionForm.name.trim()"
    :error="sectionError"
    @close="sectionOpen = false"
    @submit="submitSection"
  >
    <div class="mb-3">
      <label class="form-label required">Type</label>
      <div class="form-selectgroup">
        <label v-for="t in CV_SECTION_TYPES" :key="t.value" class="form-selectgroup-item">
          <input type="radio" class="form-selectgroup-input" :checked="sectionForm.type === t.value" @change="onSectionType(t.value)" />
          <span class="form-selectgroup-label"><i :class="['ti me-1', t.icon]"></i>{{ t.label }}</span>
        </label>
      </div>
    </div>
    <div>
      <label class="form-label required">Titre de la section</label>
      <input v-model="sectionForm.name" class="form-control" required />
      <div class="form-hint">Prérempli avec le type choisi, modifiable.</div>
    </div>
  </AppModal>

  <AppModal
    :show="itemOpen"
    :title="editingItem ? 'Modifier la ligne' : `Ajouter à « ${itemSection?.name } »`"
    size="modal-lg"
    :saving="itemSaving"
    :can-submit="!!itemForm.title?.trim()"
    :error="itemError"
    @close="itemOpen = false"
    @submit="submitItem"
  >
    <div class="row">
      <div class="col-md-6 mb-3">
        <label class="form-label required">{{ isSkill ? 'Compétence' : 'Intitulé' }}</label>
        <input v-model="itemForm.title" class="form-control" :placeholder="isSkill ? 'Vidéosurveillance' : 'Technicien installateur'" required />
      </div>
      <div class="col-md-6 mb-3">
        <label class="form-label">{{ isSkill ? 'Précision' : 'Employeur ou école' }}</label>
        <input v-model="itemForm.subtitle" class="form-control" />
      </div>

      <template v-if="isSkill">
        <div class="col-md-6 mb-3">
          <label class="form-label">Niveau : {{ itemForm.level }}/5</label>
          <input v-model.number="itemForm.level" type="range" class="form-range" min="1" max="5" step="1" />
        </div>
      </template>
      <template v-else>
        <div class="col-md-4 mb-3">
          <label class="form-label">Lieu</label>
          <input v-model="itemForm.place" class="form-control" placeholder="Dakar" />
        </div>
        <div class="col-md-4 mb-3">
          <label class="form-label">Début</label>
          <input v-model="itemForm.start_date" class="form-control" placeholder="2022" />
        </div>
        <div class="col-md-4 mb-3">
          <label class="form-label">Fin</label>
          <input v-model="itemForm.end_date" class="form-control" placeholder="2024" :disabled="itemForm.current" />
          <label class="form-check mt-1">
            <input v-model="itemForm.current" class="form-check-input" type="checkbox" />
            <span class="form-check-label">En cours</span>
          </label>
        </div>
      </template>

      <div class="col-12">
        <label class="form-label">Description</label>
        <MarkdownEditor v-model="itemForm.description" :rows="6" placeholder="- Pose et configuration…" />
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
}
.color-dot.active {
  border-color: var(--tblr-body-color);
  box-shadow: 0 0 0 2px var(--tblr-bg-surface);
}
.cv-photo {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  flex-shrink: 0;
}
.cv-item {
  margin-left: 1.5rem;
  padding: 2px 0 2px 8px;
  border-left: 2px solid var(--tblr-border-color);
}
.cv-section-title {
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid;
  padding-bottom: 2px;
  margin-bottom: 6px;
}
.cv-preview :deep(p:last-child) {
  margin-bottom: 0;
}
.cv-preview :deep(ul) {
  margin-bottom: 0.25rem;
  padding-left: 1.1rem;
}
</style>
