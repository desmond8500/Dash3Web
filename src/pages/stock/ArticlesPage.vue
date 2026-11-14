<script setup>
import { onMounted } from 'vue'
import { usePaginatedList } from '@/composables/usePaginatedList'
import { formatAmount } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'

const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/items', { per_page: 15 })
onMounted(() => load(1))

const lowStock = (a) => (a.quantity_min ?? 0) > 0 && (a.quantity ?? 0) <= a.quantity_min
</script>

<template>
  <PageHeader title="Articles" />

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header">
          <div class="input-icon w-100" style="max-width: 360px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Désignation ou référence…" />
          </div>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Catégorie</th>
                <th>Marque</th>
                <th>Fournisseur</th>
                <th class="text-end">Prix</th>
                <th class="text-end">Quantité</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-4"><div class="spinner-border text-secondary"></div></td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="6" class="text-center text-secondary py-4">Aucun article</td>
              </tr>
              <template v-else>
                <tr v-for="a in items" :key="a.id">
                  <td>
                    <div class="d-flex align-items-center">
                      <span class="avatar avatar-sm me-2" :style="{ backgroundImage: `url(${a.image})` }"></span>
                      <div>
                        <div class="fw-medium">{{ a.designation }}</div>
                        <div class="text-secondary small">{{ a.reference }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="text-secondary">{{ a.priority }}</td>
                  <td>{{ a.brand_name }}</td>
                  <td>{{ a.provider_name }}</td>
                  <td class="text-end">{{ formatAmount(a.price) }}</td>
                  <td class="text-end">
                    <span class="badge" :class="lowStock(a) ? 'bg-red-lt' : 'bg-secondary-lt'">{{ a.quantity ?? 0 }}</span>
                  </td>
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
