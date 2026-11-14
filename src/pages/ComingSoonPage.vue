<script setup>
/** Page « à venir » pour les entrées du menu pas encore développées. Titre et icône via meta de la route. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const title = computed(() => route.meta.title || 'À venir')
const icon = computed(() => route.meta.icon || 'ti-tools')
</script>

<template>
  <PageHeader :title="title" />
  <div class="page-body">
    <div class="container-xl">
      <div class="card">
        <div class="card-body">
          <div class="empty">
            <div class="empty-icon"><i :class="['ti', icon]" style="font-size: 3rem"></i></div>
            <p class="empty-title">{{ title }} : bientôt disponible</p>
            <p class="empty-subtitle text-secondary">Cette section sera ajoutée dans une prochaine version de Dash3Web.</p>
            <div class="empty-action">
              <RouterLink :to="{ name: 'dashboard' }" class="btn btn-primary"><i class="ti ti-arrow-left"></i>Tableau de bord</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
