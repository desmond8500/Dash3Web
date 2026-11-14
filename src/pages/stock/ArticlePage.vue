<script setup>
/**
 * Page Article, reprise de livewire/stock/article-page.blade.php :
 * image et tags à gauche ; informations, images, documents, liens à droite ;
 * articles associés en bas.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api, { errorMessage, normalizeList } from '@/api/client'
import {
  addArticleDependance,
  adjustArticleQuantity,
  adjustDependance,
  articleDependances,
  articleDocuments,
  articleImages,
  articleLinks,
  articleTypes,
  attachArticleTag,
  deleteArticleImage,
  detachArticleTag,
  getArticle,
  listBrands,
  listProviders,
  removeDependance,
  saveBrand,
  saveProvider,
  setArticleDefaultImage,
  uploadArticleImages,
} from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import AppModal from '@/components/AppModal.vue'
import ArticleFormModal from '@/components/forms/ArticleFormModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const route = useRoute()
const id = computed(() => route.params.id)

const article = ref(null)
const images = ref([])
const links = ref([])
const documents = ref([])
const deps = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    article.value = await getArticle(id.value)
    const [imgs, lnks, docs, dps] = await Promise.allSettled([
      articleImages(id.value),
      articleLinks(id.value),
      articleDocuments(id.value),
      articleDependances(id.value),
    ])
    images.value = imgs.status === 'fulfilled' ? imgs.value : []
    links.value = lnks.status === 'fulfilled' ? lnks.value : []
    documents.value = docs.status === 'fulfilled' ? docs.value : []
    deps.value = dps.status === 'fulfilled' ? dps.value : []
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
  { name: 'Articles', to: { name: 'articles' } },
  { name: article.value?.designation || 'Article' },
])

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n || 0))
const lowStock = computed(() => article.value && Number(article.value.quantity ?? 0) <= Number(article.value.quantity_min ?? 0))

// ---------- Quantité ----------
async function changeQty(delta) {
  try {
    const res = await adjustArticleQuantity(article.value.id, delta)
    article.value.quantity = res?.quantity ?? article.value.quantity + delta
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Tags ----------
const tagOpen = ref(false)
const tagName = ref('')
const allTypes = ref([])
async function openTags() {
  tagName.value = ''
  tagOpen.value = true
  try {
    allTypes.value = await articleTypes()
  } catch {
    allTypes.value = []
  }
}
async function addTag(name = tagName.value) {
  if (!String(name).trim()) return
  try {
    article.value.tags = await attachArticleTag(article.value.id, name)
    tagName.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function removeTag(name) {
  try {
    article.value.tags = await detachArticleTag(article.value.id, name)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Images ----------
const uploading = ref(false)
async function onImages(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  uploading.value = true
  try {
    images.value = await uploadArticleImages(article.value.id, files)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}
async function setDefault(img) {
  try {
    const { data } = await setArticleDefaultImage(article.value.id, img.path)
    article.value.image = data?.data?.image ?? img.image
    images.value = images.value.map((i) => ({ ...i, is_default: i.path === img.path }))
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function deleteImage(img) {
  if (!confirm("Supprimer l'image ?")) return
  try {
    images.value = await deleteArticleImage(article.value.id, img.path)
    if (img.is_default) article.value = await getArticle(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Édition ----------
const formOpen = ref(false)
const brands = ref([])
const providers = ref([])
async function openEdit() {
  try {
    ;[brands.value, providers.value] = await Promise.all([listBrands(), listProviders()])
  } catch {
    /* listes vides : le formulaire reste utilisable */
  }
  formOpen.value = true
}
async function onSaved() {
  formOpen.value = false
  await load()
}

// Ajout rapide marque / fournisseur (boutons de l'en-tête, comme dans Dash3)
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

// ---------- Articles associés ----------
const depOpen = ref(false)
const depSearch = ref('')
const depResults = ref([])
const depSearching = ref(false)
let depTimer
watch(depSearch, (q) => {
  clearTimeout(depTimer)
  depTimer = setTimeout(async () => {
    if (!q.trim()) {
      depResults.value = []
      return
    }
    depSearching.value = true
    try {
      const { data } = await api.get('/items', { params: { search: q.trim(), per_page: 12 } })
      depResults.value = normalizeList(data).items.filter((a) => a.id !== article.value?.id)
    } finally {
      depSearching.value = false
    }
  }, 300)
})
async function addDep(a) {
  try {
    deps.value = await addArticleDependance(article.value.id, a.id)
    depOpen.value = false
    depSearch.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function changeDep(dep, delta) {
  try {
    const { data } = await adjustDependance(dep.id, delta)
    dep.quantity = data?.data?.quantity ?? dep.quantity + delta
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function removeDep(dep) {
  try {
    await removeDependance(dep.id)
    deps.value = deps.value.filter((d) => d.id !== dep.id)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader :title="article?.designation || 'Article'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div class="btn-list">
        <button class="btn btn-primary" @click="providerOpen = true"><i class="ti ti-plus"></i> Fournisseur</button>
        <button class="btn btn-primary" @click="brandOpen = true"><i class="ti ti-plus"></i> Marque</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="article" class="row g-2">
        <!-- Colonne gauche : image + tags -->
        <div class="col-md-4">
          <div class="card">
            <a :href="article.image" target="_blank" rel="noopener" class="d-block p-2 text-center">
              <img :src="article.image" alt="" class="rounded-2 w-100" style="object-fit: contain; max-height: 325px" />
            </a>
          </div>

          <div class="card mt-2">
            <div class="card-header">
              <div class="card-title">Tags</div>
              <div class="card-actions">
                <button class="btn btn-primary" @click="openTags"><i class="ti ti-plus"></i> Tag</button>
              </div>
            </div>
            <div v-if="article.tags?.length" class="p-2">
              <span v-for="t in article.tags" :key="t" class="badge bg-primary text-light me-1 mb-1">
                {{ t }}
                <i class="ti ti-x cursor-pointer ms-1" title="Retirer" @click="removeTag(t)"></i>
              </span>
            </div>
            <div v-else class="p-2 text-secondary small">Aucun tag</div>
          </div>
        </div>

        <!-- Colonne droite -->
        <div class="col-md-8">
          <div class="row g-2">
            <!-- Informations -->
            <div class="col-md-12">
              <div class="card">
                <div class="card-header align-items-center">
                  <div class="card-title d-flex align-items-center">
                    <i class="ti ti-file-text text-primary me-1" style="font-size: 25px"></i>
                    <b>{{ article.designation }}</b>
                  </div>
                  <div class="card-actions">
                    <button class="btn btn-primary btn-icon" title="Éditer" @click="openEdit"><i class="ti ti-edit"></i></button>
                  </div>
                </div>
                <div class="row px-2">
                  <div class="col-md-6">
                    <ul class="list-group list-group-flush">
                      <li class="list-group-item d-flex justify-content-between p-2"><b>Référence :</b> {{ article.reference }}</li>
                      <li class="list-group-item d-flex justify-content-between align-items-center p-2" :class="{ 'text-danger': lowStock }">
                        <b>Quantité :</b>
                        <div class="d-flex align-items-center qty">
                          <button class="btn btn-sm rounded" title="Retirer 1" @click="changeQty(-1)">−</button>
                          <span class="mx-2">{{ article.quantity ?? 0 }}</span>
                          <button class="btn btn-sm rounded" title="Ajouter 1" @click="changeQty(1)">+</button>
                        </div>
                      </li>
                      <li class="list-group-item d-flex justify-content-between p-2"><b>Prix :</b> {{ fmt(article.price) }} CFA</li>
                      <li class="list-group-item d-flex justify-content-between p-2"><b>Poids :</b> {{ article.weight ?? '—' }} kg</li>
                    </ul>
                  </div>
                  <div class="col-md-6">
                    <ul class="list-group list-group-flush">
                      <li v-if="article.brand_name" class="list-group-item d-flex justify-content-between p-2">
                        <b>Marque :</b> <RouterLink :to="{ name: 'marques' }">{{ article.brand_name }}</RouterLink>
                      </li>
                      <li v-if="article.provider_name" class="list-group-item d-flex justify-content-between p-2">
                        <b>Fournisseur :</b> <RouterLink :to="{ name: 'fournisseurs' }">{{ article.provider_name }}</RouterLink>
                      </li>
                      <li class="list-group-item d-flex justify-content-between p-2"><b>Priorité :</b> {{ article.priority }}</li>
                      <li class="list-group-item d-flex justify-content-between p-2"><b>TVA :</b> {{ article.tva ?? '—' }}</li>
                    </ul>
                  </div>
                  <div class="col-md-12 p-0">
                    <div class="card-body border-top">
                      <h3>Description</h3>
                      <div class="pre">{{ article.description || '—' }}</div>
                    </div>
                  </div>
                  <div v-if="article.spec" class="col-md-12">
                    <div class="p-2">
                      <h3>Spécifications techniques</h3>
                      <div class="pre">{{ article.spec }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Images -->
            <div class="col-md-12">
              <div class="card">
                <div class="card-header">
                  <div class="card-title">Images</div>
                  <div class="card-actions">
                    <label class="btn btn-primary mb-0" :class="{ disabled: uploading }">
                      <span v-if="uploading" class="spinner-border spinner-border-sm me-1"></span>
                      <i v-else class="ti ti-photo-plus"></i> Ajouter
                      <input type="file" accept="image/*" multiple hidden @change="onImages" />
                    </label>
                  </div>
                </div>
                <div class="p-2">
                  <div v-if="!images.length" class="text-secondary small">Aucune image</div>
                  <div class="row g-1">
                    <div v-for="img in images" :key="img.path || img.id" class="col-4 col-md-2">
                      <div class="border rounded-2 p-1 text-center bg-white" :class="img.is_default ? 'border-success' : 'border-primary'">
                        <a :href="img.image" target="_blank" rel="noopener">
                          <img :src="img.image" class="avatar avatar-xl rounded-2 border p-1" alt="" style="object-fit: contain" />
                        </a>
                        <div class="d-flex justify-content-evenly mt-1">
                          <button class="btn btn-sm btn-ghost-danger btn-icon rounded" title="Supprimer l'image" @click="deleteImage(img)"><i class="ti ti-trash"></i></button>
                          <button class="btn btn-sm btn-icon rounded" :class="img.is_default ? 'btn-success' : 'btn-ghost-primary'" title="Définir comme image par défaut" @click="setDefault(img)"><i class="ti ti-photo"></i></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Documents -->
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header"><div class="card-title">Documents</div></div>
                <div class="list-group list-group-flush">
                  <div v-if="!documents.length" class="list-group-item text-secondary small">Aucun document</div>
                  <a v-for="d in documents" :key="d.id" :href="d.folder" target="_blank" rel="noopener" class="list-group-item list-group-item-action">
                    <i class="ti ti-file-text me-1"></i>{{ d.name }}
                  </a>
                </div>
              </div>
            </div>

            <!-- Liens -->
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header"><div class="card-title">Liens</div></div>
                <div class="list-group list-group-flush">
                  <div v-if="!links.length" class="list-group-item text-secondary small">Aucun lien</div>
                  <a v-for="l in links" :key="l.id" :href="l.link" target="_blank" rel="noopener" class="list-group-item list-group-item-action">
                    <i class="ti ti-link me-1"></i>{{ l.name }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Articles associés -->
        <div class="col-md-12">
          <div class="card">
            <div class="card-header">
              <div class="card-title">Articles associés</div>
              <div class="card-actions">
                <button class="btn btn-primary" @click="depOpen = true"><i class="ti ti-plus"></i> Article</button>
              </div>
            </div>
            <div class="card-body">
              <div v-if="!deps.length" class="text-secondary small">Aucun article associé</div>
              <div class="row g-2">
                <div v-for="d in deps" :key="d.id" class="col-md-3">
                  <RouterLink :to="{ name: 'article', params: { id: d.article.id } }" class="card card-sm text-reset text-decoration-none">
                    <div class="card-body d-flex align-items-center gap-2">
                      <img :src="d.article.image" alt="" class="avatar rounded-2" style="object-fit: contain" />
                      <div class="min-w-0">
                        <div class="fw-bold text-truncate">{{ d.article.designation }}</div>
                        <div class="text-secondary small">{{ d.article.reference }}</div>
                      </div>
                    </div>
                  </RouterLink>
                  <div class="d-flex justify-content-between align-items-center mt-2">
                    <button class="btn btn-outline-danger btn-icon" title="Retirer" @click="removeDep(d)"><i class="ti ti-trash"></i></button>
                    <div class="d-flex align-items-center">
                      <button class="btn btn-icon btn-primary" title="Ajouter 1" @click="changeDep(d, 1)"><i class="ti ti-plus"></i></button>
                      <div class="btn">{{ d.quantity }}</div>
                      <button class="btn btn-icon btn-primary" title="Retirer 1" @click="changeDep(d, -1)"><i class="ti ti-minus"></i></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Édition -->
  <ArticleFormModal :show="formOpen" :article="article" :brands="brands" :providers="providers" @close="formOpen = false" @saved="onSaved" />

  <!-- Tags -->
  <AppModal :show="tagOpen" title="Tags" submit-label="Ajouter" :can-submit="!!tagName.trim()" @close="tagOpen = false" @submit="addTag()">
    <div class="row g-1">
      <div class="col">
        <input v-model="tagName" type="text" class="form-control" placeholder="Ajouter un tag" />
      </div>
    </div>
    <div class="mt-2">
      <a v-for="t in allTypes" :key="t.id" class="badge bg-primary text-white mb-1 me-1 cursor-pointer" @click="addTag(t.name)">{{ t.name }}</a>
    </div>
  </AppModal>

  <!-- Articles associés : recherche -->
  <AppModal :show="depOpen" title="Ajouter un article" size="modal-lg" submit-label="Fermer" @close="depOpen = false" @submit="depOpen = false">
    <input v-model="depSearch" type="search" class="form-control mb-2" placeholder="Désignation ou référence…" />
    <div v-if="depSearching" class="text-center py-2"><div class="spinner-border spinner-border-sm"></div></div>
    <div class="list-group">
      <button v-for="a in depResults" :key="a.id" type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" @click="addDep(a)">
        <img :src="a.image" alt="" class="avatar avatar-sm rounded-2" style="object-fit: contain" />
        <div>
          <div class="fw-medium">{{ a.designation }}</div>
          <div class="text-secondary small">{{ a.reference }}</div>
        </div>
        <i class="ti ti-plus ms-auto"></i>
      </button>
    </div>
  </AppModal>

  <NamedFormModal :show="brandOpen" title="Ajouter une marque" :fields="brandFields" :submit="(v) => saveBrand(v)" @close="brandOpen = false" @saved="brandOpen = false" />
  <NamedFormModal :show="providerOpen" title="Ajouter un fournisseur" :fields="providerFields" :submit="(v) => saveProvider(v)" @close="providerOpen = false" @saved="providerOpen = false" />
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
.qty .btn {
  min-width: 28px;
}
</style>
