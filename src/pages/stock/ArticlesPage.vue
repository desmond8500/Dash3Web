<script setup>
/**
 * Page Articles, reprise de livewire/stock/articles-page.blade.php :
 * filtres à gauche (recherche, marques, fournisseurs, priorités), cartes à droite,
 * affichage grille ou liste.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { PRIORITIES, articleTypes, deleteArticle, listBrands, listProviders, orderArticle, saveBrand, saveProvider } from '@/api/dash3'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import ArticleCard from '@/components/cards/ArticleCard.vue'
import ArticleFormModal from '@/components/forms/ArticleFormModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const params = reactive({ per_page: 18, brand_id: undefined, provider_id: undefined, priority_id: undefined, type: undefined })
const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/items', params)

const brands = ref([])
const providers = ref([])
const types = ref([])
async function loadFilters() {
  try {
    ;[brands.value, providers.value, types.value] = await Promise.all([listBrands(), listProviders(), articleTypes()])
  } catch (e) {
    error.value = errorMessage(e)
  }
}
onMounted(() => Promise.all([load(1), loadFilters()]))

// ---------- Filtres ----------
const open = reactive({ brand: true, provider: false, priority: false, type: false })
const searchBrand = ref('')
const searchProvider = ref('')
const shownBrands = computed(() => brands.value.filter((b) => b.name?.toLowerCase().includes(searchBrand.value.toLowerCase())))
const shownProviders = computed(() => providers.value.filter((p) => p.name?.toLowerCase().includes(searchProvider.value.toLowerCase())))

function setFilter(key, value) {
  params[key] = params[key] === value ? undefined : value
  load(1)
}
function resetFilter() {
  params.brand_id = params.provider_id = params.priority_id = params.type = undefined
  search.value = ''
  load(1)
}

// ---------- Affichage ----------
const card = ref('col-md-6 col-xl-4')

// ---------- Article : ajout, édition, duplication, suppression ----------
const formOpen = ref(false)
const editing = ref(null)
const duplicating = ref(false)
function openForm(article = null, duplicate = false) {
  editing.value = article
  duplicating.value = duplicate
  formOpen.value = true
}
async function onSaved() {
  formOpen.value = false
  await load()
}
async function remove(article) {
  if (!confirm(`Supprimer l'article « ${article.designation} » ?`)) return
  try {
    await deleteArticle(article.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Commander (ajoute l'article aux commandes) ----------
const notice = ref('')
async function order(article) {
  const qty = Number(prompt(`Quantité à commander pour « ${article.designation} » :`, '1'))
  if (!qty || qty < 1) return
  try {
    await orderArticle(article.id, Math.trunc(qty))
    notice.value = `${Math.trunc(qty)} × ${article.designation} ajouté aux commandes.`
    setTimeout(() => (notice.value = ''), 4000)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Ajout rapide marque / fournisseur ----------
const brandOpen = ref(false)
const providerOpen = ref(false)
const brandFields = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const providerFields = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'phone', label: 'Téléphone', type: 'tel', col: 'col-md-6' },
  { name: 'email', label: 'E-mail', type: 'email', col: 'col-md-6' },
  { name: 'website', label: 'Site web', type: 'url' },
  { name: 'address', label: 'Adresse' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
async function afterQuickAdd() {
  brandOpen.value = providerOpen.value = false
  await loadFilters()
}
</script>

<template>
  <PageHeader title="Articles" :loading="loading">
    <template #actions>
      <div class="btn-list">
        <button class="btn btn-primary" @click="openForm()"><i class="ti ti-plus"></i> Article</button>
        <button class="btn btn-primary" @click="providerOpen = true"><i class="ti ti-plus"></i> Fournisseur</button>
        <button class="btn btn-primary" @click="brandOpen = true"><i class="ti ti-plus"></i> Marque</button>
        <button class="btn btn-dark btn-icon" title="Grille" @click="card = 'col-md-6 col-xl-4'"><i class="ti ti-layout-grid"></i></button>
        <button class="btn btn-dark btn-icon" title="Liste" @click="card = 'col-md-12 col-xl-12'"><i class="ti ti-layout-list"></i></button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="notice" class="alert alert-success">{{ notice }}</div>

      <div class="row g-2">
        <!-- Filtres -->
        <div class="col-md-3 col-xl-2">
          <div class="mb-1">
            <div class="input-group">
              <input v-model="search" type="text" class="form-control" placeholder="Trouver un article" />
              <button class="btn btn-icon" title="Réinitialiser les filtres" @click="resetFilter"><i class="ti ti-reload"></i></button>
            </div>
          </div>

          <div class="card">
            <div class="accordion accordion-flush">
              <!-- Marques -->
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button" :class="{ collapsed: !open.brand }" type="button" @click="open.brand = !open.brand">Marques</button>
                </h2>
                <div v-show="open.brand" class="accordion-body pt-0">
                  <div class="input-icon mb-2">
                    <input v-model="searchBrand" type="text" class="form-control form-control-rounded" placeholder="Chercher une marque" />
                    <span class="input-icon-addon"><i class="ti ti-search"></i></span>
                  </div>
                  <button
                    v-for="b in shownBrands"
                    :key="b.id"
                    class="btn btn-sm rounded mb-1 me-1"
                    :class="params.brand_id === b.id ? 'btn-primary' : 'btn-outline-primary'"
                    @click="setFilter('brand_id', b.id)"
                  >
                    {{ b.name }}
                  </button>
                </div>
              </div>
              <!-- Fournisseurs -->
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button" :class="{ collapsed: !open.provider }" type="button" @click="open.provider = !open.provider">Fournisseurs</button>
                </h2>
                <div v-show="open.provider" class="accordion-body pt-0">
                  <div class="input-icon mb-2">
                    <input v-model="searchProvider" type="text" class="form-control form-control-rounded" placeholder="Chercher un fournisseur" />
                    <span class="input-icon-addon"><i class="ti ti-search"></i></span>
                  </div>
                  <button
                    v-for="p in shownProviders"
                    :key="p.id"
                    class="btn btn-sm rounded mb-1 me-1"
                    :class="params.provider_id === p.id ? 'btn-primary' : 'btn-outline-primary'"
                    @click="setFilter('provider_id', p.id)"
                  >
                    {{ p.name }}
                  </button>
                </div>
              </div>
              <!-- Priorités -->
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button" :class="{ collapsed: !open.priority }" type="button" @click="open.priority = !open.priority">Priorités</button>
                </h2>
                <div v-show="open.priority" class="accordion-body pt-0">
                  <button
                    v-for="p in PRIORITIES"
                    :key="p.id"
                    class="btn btn-sm rounded mb-1 me-1"
                    :class="params.priority_id === p.id ? 'btn-primary' : 'btn-outline-primary'"
                    @click="setFilter('priority_id', p.id)"
                  >
                    {{ p.name }}
                  </button>
                </div>
              </div>
              <!-- Types -->
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button" :class="{ collapsed: !open.type }" type="button" @click="open.type = !open.type">Types</button>
                </h2>
                <div v-show="open.type" class="accordion-body pt-0">
                  <div v-if="!types.length" class="text-secondary small">Aucun type</div>
                  <span
                    v-for="t in types"
                    :key="t.id"
                    class="badge cursor-pointer mb-1 me-1"
                    :class="params.type === t.name ? 'bg-primary text-light' : 'bg-primary-lt'"
                    @click="setFilter('type', t.name)"
                  >
                    {{ t.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Articles -->
        <div class="col-md-9 col-xl-10">
          <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
          <div v-else-if="!items.length" class="empty">
            <div class="empty-icon"><i class="ti ti-package-off" style="font-size: 3rem"></i></div>
            <p class="empty-title">Aucun article</p>
            <div class="empty-action"><button class="btn btn-primary" @click="resetFilter"><i class="ti ti-reload"></i>Réinitialiser les filtres</button></div>
          </div>
          <template v-else>
            <div class="row row-deck g-2">
              <div v-for="a in items" :key="a.id" :class="card">
                <ArticleCard
                  :article="a"
                  @edit="openForm($event)"
                  @duplicate="openForm($event, true)"
                  @order="order"
                  @delete="remove"
                  @brand="setFilter('brand_id', $event)"
                  @provider="setFilter('provider_id', $event)"
                />
              </div>
            </div>
            <div class="card mt-2">
              <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <ArticleFormModal
    :show="formOpen"
    :article="editing"
    :duplicate="duplicating"
    :brands="brands"
    :providers="providers"
    @close="formOpen = false"
    @saved="onSaved"
  />
  <NamedFormModal :show="brandOpen" title="Ajouter une marque" :fields="brandFields" :submit="(v) => saveBrand(v)" @close="brandOpen = false" @saved="afterQuickAdd" />
  <NamedFormModal :show="providerOpen" title="Ajouter un fournisseur" :fields="providerFields" :submit="(v) => saveProvider(v)" @close="providerOpen = false" @saved="afterQuickAdd" />
</template>
