<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { formatAmount, formatDate, monthInvoices, monthPaidInvoices } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const months = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' }),
}))
const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

const factures = ref([])
const payes = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [f, p] = await Promise.all([monthInvoices(month.value, year.value), monthPaidInvoices(month.value, year.value)])
    factures.value = f
    payes.value = p
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([month, year], load)

const sum = (list) => list.reduce((s, d) => s + Number(d.montant || 0), 0)
// Dépenses rattachées aux devis facturés dans le mois
const depenses = computed(() =>
  factures.value.reduce((s, d) => s + (d.spents ?? []).reduce((t, x) => t + Number(x.montant || 0), 0), 0),
)

const cards = computed(() => [
  { label: 'Facturé', value: sum(factures.value), count: factures.value.length, icon: 'ti-file-invoice', color: 'bg-primary' },
  { label: 'Encaissé', value: sum(payes.value), count: payes.value.length, icon: 'ti-cash', color: 'bg-green' },
  { label: 'Dépenses', value: depenses.value, count: null, icon: 'ti-receipt', color: 'bg-red' },
  { label: 'Marge (facturé − dépenses)', value: sum(factures.value) - depenses.value, count: null, icon: 'ti-trending-up', color: 'bg-azure' },
])

function shift(delta) {
  let m = month.value + delta
  let y = year.value
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  month.value = m
  year.value = y
}
</script>

<template>
  <PageHeader title="Bilan mensuel" :loading="loading">
    <template #actions>
      <div class="d-flex gap-2">
        <button class="btn btn-icon" title="Mois précédent" @click="shift(-1)"><i class="ti ti-chevron-left"></i></button>
        <select v-model.number="month" class="form-select text-capitalize" aria-label="Mois">
          <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <select v-model.number="year" class="form-select" aria-label="Année">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
        <button class="btn btn-icon" title="Mois suivant" @click="shift(1)"><i class="ti ti-chevron-right"></i></button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="row row-deck row-cards">
        <div v-for="c in cards" :key="c.label" class="col-sm-6 col-lg-3">
          <div class="card card-sm">
            <div class="card-body">
              <div class="row align-items-center">
                <div class="col-auto"><span :class="['text-white avatar rounded-2', c.color]"><i :class="['ti', c.icon]"></i></span></div>
                <div class="col">
                  <div class="text-secondary small">{{ c.label }}</div>
                  <div class="h3 m-0">{{ formatAmount(c.value) }}</div>
                  <div v-if="c.count !== null" class="text-secondary small">{{ c.count }} devis</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card">
            <div class="card-header"><h3 class="card-title">Facturés dans le mois</h3></div>
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>Devis</th><th>Date</th><th class="text-end">Montant</th></tr></thead>
                <tbody>
                  <tr v-if="!factures.length"><td colspan="3" class="text-center text-secondary py-3">Aucun devis facturé</td></tr>
                  <tr v-for="d in factures" :key="d.id">
                    <td>
                      <div class="fw-medium">{{ d.reference }}</div>
                      <div class="text-secondary small">{{ d.client_name }}<span v-if="d.projet_name"> · {{ d.projet_name }}</span></div>
                    </td>
                    <td class="text-secondary">{{ formatDate(d.facture_date) }}</td>
                    <td class="text-end">{{ formatAmount(d.montant) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card">
            <div class="card-header"><h3 class="card-title">Payés dans le mois</h3></div>
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>Devis</th><th>Payé le</th><th class="text-end">Montant</th></tr></thead>
                <tbody>
                  <tr v-if="!payes.length"><td colspan="3" class="text-center text-secondary py-3">Aucun paiement</td></tr>
                  <tr v-for="d in payes" :key="d.id">
                    <td>
                      <div class="fw-medium">{{ d.reference }}</div>
                      <div class="text-secondary small">{{ d.client_name }}<span v-if="d.projet_name"> · {{ d.projet_name }}</span></div>
                    </td>
                    <td class="text-secondary">{{ formatDate(d.paydate) }}</td>
                    <td class="text-end">{{ formatAmount(d.montant) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
