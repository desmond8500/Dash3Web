<script setup>
/**
 * En-tête de page au format Dash3 : fil d'Ariane (accueil + étapes) au-dessus du titre.
 * Les étapes viennent de la prop `breadcrumbs` ou, à défaut, de `meta.breadcrumbs` de la route.
 * Une étape : { name: 'Clients', to: { name: 'clients' } } ; la dernière est la page courante.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  pretitle: { type: String, default: '' },
  breadcrumbs: { type: Array, default: null },
  loading: { type: Boolean, default: false },
})

const route = useRoute()
const crumbs = computed(() => props.breadcrumbs ?? route.meta.breadcrumbs ?? [])
</script>

<template>
  <div class="page-header d-print-none">
    <div class="container-xl">
      <div class="row g-2 align-items-center">
        <div class="col">
          <ol class="breadcrumb mb-1" aria-label="Fil d'Ariane">
            <li class="breadcrumb-item">
              <RouterLink :to="{ name: 'dashboard' }" title="Accueil"><i class="ti ti-home"></i></RouterLink>
            </li>
            <li
              v-for="(c, i) in crumbs"
              :key="i"
              class="breadcrumb-item"
              :class="{ active: i === crumbs.length - 1 }"
              :aria-current="i === crumbs.length - 1 ? 'page' : undefined"
            >
              <RouterLink v-if="c.to && i < crumbs.length - 1" :to="c.to">{{ c.name }}</RouterLink>
              <span v-else>{{ c.name }}</span>
            </li>
          </ol>
          <div v-if="pretitle" class="page-pretitle">{{ pretitle }}</div>
          <h2 class="page-title">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
            <span class="text-truncate">{{ title }}</span>
          </h2>
        </div>
        <div class="col-auto ms-auto d-print-none">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>
