<script setup>
/** Liste des devis (menu ERP › Devis), avec recherche. */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePaginatedList } from '@/composables/usePaginatedList'
import { formatAmount, formatDate } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'

const router = useRouter()
const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/invoices', { per_page: 20 })
onMounted(() => load(1))

const statusColor = (s) =>
  ({ Proforma: 'bg-secondary', Nouveau: 'bg-blue', 'En Cours': 'bg-azure', 'En Pause': 'bg-yellow', Annulé: 'bg-red', 'Bl a faire': 'bg-orange', 'A Facturer': 'bg-purple', 'Paiement en attente': 'bg-pink', Terminé: 'bg-green' })[s] ||
  'bg-secondary'
</script>

<template>
  <PageHeader title="Devis" :loading="loading">
    <template #actions>
      <input v-model="search" type="search" class="form-control w-auto" placeholder="Référence, client, projet…" aria-label="Rechercher un devis" />
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-vcenter card-table table-clickable">
            <thead>
              <tr><th>Référence</th><th>Client · Projet</th><th>Statut</th><th>Créé le</th><th class="text-end">Montant</th></tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="5" class="text-center py-4"><div class="spinner-border text-secondary"></div></td></tr>
              <tr v-else-if="!items.length"><td colspan="5" class="text-center text-secondary py-4">Aucun devis</td></tr>
              <template v-else>
                <tr v-for="d in items" :key="d.id" @click="router.push({ name: 'devis', params: { id: d.id } })">
                  <td>
                    <div class="fw-medium text-primary">#{{ d.reference }} <i v-if="d.favorite" class="ti ti-heart-filled text-danger"></i></div>
                    <div class="text-secondary small text-truncate" style="max-width: 280px">{{ d.description }}</div>
                  </td>
                  <td>{{ d.client_name }}<span v-if="d.projet_name" class="text-secondary"> · {{ d.projet_name }}</span></td>
                  <td><span class="badge text-white" :class="statusColor(d.statut)">{{ d.statut }}</span></td>
                  <td class="text-secondary">{{ formatDate(d.facture_date) }}</td>
                  <td class="text-end fw-medium text-nowrap">{{ formatAmount(d.montant) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
      </div>
    </div>
  </div>
</template>
