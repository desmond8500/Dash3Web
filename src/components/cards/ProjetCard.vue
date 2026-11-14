<script setup>
/** Carte projet, reprise de resources/views/_card/projet_card.blade.php (Dash3). */
defineProps({ projet: { type: Object, required: true } })
const emit = defineEmits(['edit', 'delete', 'favorite'])
</script>

<template>
  <div class="card p-2 border mb-2" :class="projet.favorite ? 'border-danger' : 'border-primary'">
    <div class="row g-1 align-items-center">
      <RouterLink class="col-auto" :to="{ name: 'projet', params: { id: projet.id } }">
        <img class="avatar rounded-2 p-1" :src="projet.logo_url" alt="" style="object-fit: contain" />
      </RouterLink>
      <RouterLink class="col text-decoration-none" :to="{ name: 'projet', params: { id: projet.id } }">
        <div class="fw-bold">{{ projet.name }}</div>
      </RouterLink>
      <div class="col-auto">
        <div class="dropdown">
          <button class="btn btn-action border dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
            <i class="ti ti-chevron-down"></i>
          </button>
          <div class="dropdown-menu dropdown-menu-end">
            <button class="dropdown-item" type="button" @click="emit('edit', projet)"><i class="ti ti-edit me-2"></i>Éditer</button>
            <button class="dropdown-item text-danger" type="button" @click="emit('delete', projet)"><i class="ti ti-trash me-2"></i>Supprimer</button>
            <button class="dropdown-item" type="button" @click="emit('favorite', projet)">
              <span v-if="projet.favorite" class="text-danger"><i class="ti ti-heart-filled"></i> Favoris</span>
              <span v-else class="text-muted"><i class="ti ti-heart"></i> Favoris</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="d-flex justify-content-between mt-2 p-1 rounded" :class="projet.favorite ? 'bg-red-lt' : 'bg-blue-lt'">
      <div><b>Devis:</b> {{ projet.devis_count ?? '—' }}</div>
      <div><b>Taches:</b> {{ projet.tasks_count ?? '—' }}</div>
    </div>
    <div v-if="projet.description" class="border-top mt-1 pt-1 description">{{ projet.description }}</div>
  </div>
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
