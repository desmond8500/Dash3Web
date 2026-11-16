<script setup>
/**
 * Carte de journal au style de Dash3 (_card/journal_card.blade.php) :
 * bloc date (jour, numéro, mois, année), type en en-tête, titre, client / projet.
 */
import { computed } from 'vue'

const props = defineProps({
  journal: { type: Object, required: true },
  /** Afficher les compteurs sections / intervenants */
  counts: { type: Boolean, default: false },
})
const emit = defineEmits(['edit', 'delete'])

const date = computed(() => {
  const d = props.journal.date ? new Date(props.journal.date) : null
  if (!d || Number.isNaN(d.getTime())) return null
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace('.', '')
  return {
    day: cap(d.toLocaleDateString('fr-FR', { weekday: 'long' })),
    num: String(d.getDate()).padStart(2, '0'),
    month: cap(d.toLocaleDateString('fr-FR', { month: 'short' })),
    year: d.getFullYear(),
  }
})
const client = computed(() => props.journal.projet?.client ?? null)
</script>

<template>
  <div class="card p-2 h-100">
    <div class="row g-2 flex-nowrap">
      <div class="col-auto text-primary">
        <div class="journal-date text-center border border-info rounded p-1">
          <template v-if="date">
            <div class="fw-bold text-secondary day">{{ date.day }}</div>
            <div class="display-6 lh-1">{{ date.num }}</div>
            <div class="fw-bold">{{ date.month }}</div>
            <div class="fw-bold year">{{ date.year }}</div>
          </template>
          <i v-else class="ti ti-calendar-off fs-1"></i>
        </div>
      </div>
      <div class="col min-w-0">
        <div class="d-flex align-items-start gap-1">
          <div class="flex-fill text-primary fw-bold mt-1 text-center border-bottom pb-1 text-truncate">
            {{ (journal.type || "Rapport d'intervention").toUpperCase() }}
          </div>
          <div class="dropdown">
            <button class="btn btn-action border" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
              <i class="ti ti-dots-vertical"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-end">
              <RouterLink class="dropdown-item" :to="{ name: 'journal', params: { id: journal.id } }"><i class="ti ti-eye me-2"></i> Consulter</RouterLink>
              <button class="dropdown-item" type="button" @click="emit('edit', journal)"><i class="ti ti-edit me-2"></i> Éditer</button>
              <button class="dropdown-item text-danger" type="button" @click="emit('delete', journal)"><i class="ti ti-trash me-2"></i> Supprimer</button>
            </div>
          </div>
        </div>

        <RouterLink :to="{ name: 'journal', params: { id: journal.id } }" class="fw-bold text-reset d-block mt-1 text-truncate" :title="journal.title">
          {{ journal.title }}
        </RouterLink>

        <div v-if="journal.projet" class="small-link text-truncate">
          <RouterLink v-if="client" :to="{ name: 'projets', query: { client_id: client.id } }">{{ client.name }} / </RouterLink>
          <RouterLink :to="{ name: 'projet', params: { id: journal.projet.id } }">{{ journal.projet.name }}</RouterLink>
        </div>

        <div v-if="counts" class="mt-1">
          <span class="badge bg-azure-lt me-1" title="Sections"><i class="ti ti-list-details"></i> {{ journal.sections_count ?? 0 }}</span>
          <span class="badge bg-primary-lt" title="Intervenants"><i class="ti ti-users"></i> {{ journal.intervenants_count ?? 0 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.journal-date {
  width: 70px;
}
.journal-date .day {
  font-size: 10px;
}
.journal-date .year {
  font-size: 17px;
}
.small-link {
  font-size: 11px;
}
</style>
