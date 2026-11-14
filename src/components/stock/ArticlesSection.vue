<script setup>
/**
 * Grille d'articles filtrée (articles d'une marque ou d'un fournisseur) :
 * recherche, pagination, édition, duplication, commande et suppression.
 */
import { onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { deleteArticle, listBrands, listProviders, orderArticle } from '@/api/dash3'
import { usePaginatedList } from '@/composables/usePaginatedList'
import Pagination from '@/components/Pagination.vue'
import ArticleCard from '@/components/cards/ArticleCard.vue'
import ArticleFormModal from '@/components/forms/ArticleFormModal.vue'

const props = defineProps({
  /** Filtre imposé, ex. { brand_id: 3 } ou { provider_id: 7 } */
  filter: { type: Object, required: true },
  col: { type: String, default: 'col-md-6 col-xl-4' },
})

const params = { per_page: 18, ...props.filter }
const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/items', params)
onMounted(() => load(1))

const notice = ref('')

// Édition / duplication : marques et fournisseurs chargés à la première ouverture
const brands = ref([])
const providers = ref([])
const formOpen = ref(false)
const editing = ref(null)
const duplicating = ref(false)
async function openForm(article, duplicate = false) {
  editing.value = article
  duplicating.value = duplicate
  if (!brands.value.length) {
    try {
      ;[brands.value, providers.value] = await Promise.all([listBrands(), listProviders()])
    } catch {
      /* listes vides : le formulaire reste utilisable */
    }
  }
  formOpen.value = true
}
async function onSaved() {
  formOpen.value = false
  await load(page.value)
}
async function remove(article) {
  if (!confirm(`Supprimer l'article « ${article.designation} » ?`)) return
  try {
    await deleteArticle(article.id)
    await load(page.value)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
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
</script>

<template>
  <div>
    <div class="d-flex mb-2">
      <div class="input-icon" style="max-width: 320px">
        <span class="input-icon-addon"><i class="ti ti-search"></i></span>
        <input v-model="search" type="search" class="form-control" placeholder="Trouver un article" />
      </div>
      <div class="ms-auto text-secondary align-self-center small">{{ total }} article(s)</div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="notice" class="alert alert-success">{{ notice }}</div>

    <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
    <div v-else-if="!items.length" class="card card-body text-secondary text-center">Aucun article</div>
    <template v-else>
      <div class="row row-deck g-2">
        <div v-for="a in items" :key="a.id" :class="col">
          <ArticleCard :article="a" @edit="openForm($event)" @duplicate="openForm($event, true)" @order="order" @delete="remove" />
        </div>
      </div>
      <div class="card mt-2">
        <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
      </div>
    </template>

    <ArticleFormModal
      :show="formOpen"
      :article="editing"
      :duplicate="duplicating"
      :brands="brands"
      :providers="providers"
      @close="formOpen = false"
      @saved="onSaved"
    />
  </div>
</template>
