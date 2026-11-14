<script setup>
import { onMounted, ref, watch } from 'vue'
import { usePaginatedList } from '@/composables/usePaginatedList'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import TaskList from '@/components/erp/TaskList.vue'

const statut = ref('')
const params = { per_page: 15 } // objet partagé avec usePaginatedList : les filtres ajoutés ici sont envoyés
const { items, page, lastPage, total, search, loading, error, load } = usePaginatedList('/tasks', params)

onMounted(() => load(1))
watch(statut, (v) => {
  params.statut = v || undefined
  load(1)
})
const list = ref(null)
</script>

<template>
  <PageHeader title="Tâches">
    <template #actions>
      <button class="btn btn-primary" @click="list.edit()"><i class="ti ti-plus"></i> Tâche</button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-header gap-2 flex-wrap">
          <div class="input-icon" style="max-width: 320px">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="search" type="search" class="form-control" placeholder="Rechercher une tâche…" />
          </div>
          <select v-model="statut" class="form-select w-auto">
            <option value="">Toutes les tâches</option>
            <option value="active">En cours (non terminées)</option>
            <option value="finished">Terminées</option>
          </select>
        </div>

        <div v-if="error" class="alert alert-danger m-3">{{ error }}</div>

        <!-- Fil d'Ariane client › projet › tâche au-dessus de chaque tâche -->
        <TaskList ref="list" flush :tasks="items" :loading="loading" @changed="load(page)" />

        <Pagination :page="page" :last-page="lastPage" :total="total" @change="load" />
      </div>
    </div>
  </div>
</template>
