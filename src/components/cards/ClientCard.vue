<script setup>
/** Carte client, reprise de resources/views/_card/client_card.blade.php (Dash3). */
defineProps({ client: { type: Object, required: true } })
const emit = defineEmits(['edit', 'delete', 'favorite', 'logo'])
</script>

<template>
  <div class="card p-1 bg-light rounded border-primary client-card">
    <div class="p-2 rounded" :class="client.type === 'Entreprise' ? 'bg-primary' : 'bg-cyan'">
      <div class="row g-2 align-items-center">
        <RouterLink class="col-auto" :to="{ name: 'projets', query: { client_id: client.id } }">
          <img :src="client.avatar" alt="" class="avatar rounded-2 p-1 bg-white" style="object-fit: contain" />
        </RouterLink>
        <RouterLink class="col text-white text-decoration-none" :to="{ name: 'projets', query: { client_id: client.id } }">
          <div>{{ client.type || 'Type' }}</div>
          <div class="fw-bold">{{ client.name }}</div>
        </RouterLink>
        <div class="col-auto">
          <div class="dropdown">
            <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
              <i class="ti ti-chevron-down text-white"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-end">
              <button class="dropdown-item" type="button" @click="emit('edit', client)"><i class="ti ti-edit"></i> Éditer</button>
              <button class="dropdown-item" type="button" @click="emit('logo', client)"><i class="ti ti-photo-edit"></i> Éditer le logo</button>
              <button class="dropdown-item text-danger" type="button" @click="emit('delete', client)"><i class="ti ti-trash"></i> Supprimer</button>
              <button class="dropdown-item" type="button" @click="emit('favorite', client)">
                <span v-if="client.favorite" class="text-danger"><i class="ti ti-heart-filled"></i> Favoris</span>
                <span v-else class="text-muted"><i class="ti ti-heart"></i> Favoris</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between p-2">
      <div><i class="ti ti-box"></i> Projets: <b>{{ client.projets_count ?? '—' }}</b></div>
      <div><i class="ti ti-box"></i> Taches: <b>{{ client.tasks_count ?? '—' }}</b></div>
    </div>
    <div class="p-2 border-top description">{{ client.description }}</div>
  </div>
</template>

<style scoped>
.description {
  white-space: pre-line;
}
.client-card:hover {
  box-shadow: 0 0 0 1px var(--tblr-primary);
}
</style>
