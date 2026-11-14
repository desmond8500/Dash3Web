<script setup>
/**
 * Page Commandes, reprise de livewire/stock/commandes.blade.php :
 * demandes de réapprovisionnement fusionnées par article (quantité ajustable)
 * et articles sous le seuil de stock minimum.
 */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { formatAmount, listCommandes, orderArticle, removeCommande, setCommandeQuantity } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'

const data = ref({ commandes: [], low_stock: [] })
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await listCommandes()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const total = computed(() => data.value.commandes.reduce((n, c) => n + (c.article.price || 0) * c.quantity, 0))
const ordered = computed(() => new Set(data.value.commandes.map((c) => c.article_id)))

async function adjust(c, delta) {
  try {
    const r = await setCommandeQuantity(c.article_id, { delta })
    c.quantity = r.quantity
    if (!c.quantity) data.value.commandes = data.value.commandes.filter((x) => x.article_id !== c.article_id)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function remove(c) {
  if (!confirm(`Retirer « ${c.article.designation} » des commandes ?`)) return
  try {
    await removeCommande(c.article_id)
    data.value.commandes = data.value.commandes.filter((x) => x.article_id !== c.article_id)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
/** Ajoute un article sous le seuil aux commandes (quantité manquante) */
async function orderLow(a) {
  const missing = Math.max(1, (a.quantity_min ?? 0) - (a.quantity ?? 0))
  try {
    await orderArticle(a.id, missing)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader title="Commandes">
    <template #actions>
      <button class="btn btn-icon" title="Actualiser" @click="load"><i class="ti ti-reload"></i></button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>

      <div v-else class="row g-3">
        <!-- Commandes en cours -->
        <div class="col-lg-7">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-shopping-cart text-primary"></i>À commander</h3>
              <div class="ms-auto fw-bold">{{ formatAmount(total) }}</div>
            </div>
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>Article</th><th>Demandes</th><th class="text-center">Quantité</th><th>Montant</th><th class="w-1"></th></tr></thead>
                <tbody>
                  <tr v-if="!data.commandes.length"><td colspan="5" class="text-center text-secondary py-3">Aucune commande en attente</td></tr>
                  <tr v-for="c in data.commandes" :key="c.article_id">
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <RouterLink :to="{ name: 'article', params: { id: c.article_id } }">
                          <img :src="c.article.image" alt="" class="avatar rounded-2 bg-white" style="object-fit: contain" />
                        </RouterLink>
                        <div class="min-w-0">
                          <RouterLink :to="{ name: 'article', params: { id: c.article_id } }" class="fw-medium text-reset d-block text-truncate">
                            {{ c.article.designation }}
                          </RouterLink>
                          <div class="text-secondary small">
                            {{ c.article.reference }}
                            <span v-if="c.article.provider_name" class="badge bg-blue-lt ms-1">{{ c.article.provider_name }}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-secondary">{{ c.demandes }}</td>
                    <td>
                      <div class="d-flex align-items-center justify-content-center gap-1">
                        <button class="btn btn-sm btn-icon" aria-label="Moins" @click="adjust(c, -1)"><i class="ti ti-minus"></i></button>
                        <b style="min-width: 2.5ch; text-align: center">{{ c.quantity }}</b>
                        <button class="btn btn-sm btn-icon" aria-label="Plus" @click="adjust(c, 1)"><i class="ti ti-plus"></i></button>
                      </div>
                    </td>
                    <td class="text-nowrap">{{ formatAmount((c.article.price || 0) * c.quantity) }}</td>
                    <td>
                      <button class="btn btn-icon btn-ghost-danger" title="Retirer" @click="remove(c)"><i class="ti ti-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Articles sous le seuil -->
        <div class="col-lg-5">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-alert-triangle text-warning"></i>Stock sous le seuil</h3>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!data.low_stock.length" class="list-group-item text-secondary">Aucun article sous le seuil.</div>
              <div v-for="a in data.low_stock" :key="a.id" class="list-group-item d-flex align-items-center gap-2">
                <RouterLink :to="{ name: 'article', params: { id: a.id } }">
                  <img :src="a.image" alt="" class="avatar rounded-2 bg-white" style="object-fit: contain" />
                </RouterLink>
                <div class="min-w-0 flex-fill">
                  <RouterLink :to="{ name: 'article', params: { id: a.id } }" class="fw-medium text-reset d-block text-truncate">{{ a.designation }}</RouterLink>
                  <div class="small">
                    <span class="text-danger">{{ a.quantity ?? 0 }}</span>
                    <span class="text-secondary"> / seuil {{ a.quantity_min }}</span>
                  </div>
                </div>
                <button v-if="!ordered.has(a.id)" class="btn btn-sm" title="Ajouter aux commandes" @click="orderLow(a)">
                  <i class="ti ti-cart-plus"></i> Commander
                </button>
                <span v-else class="badge bg-green-lt">Dans les commandes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
