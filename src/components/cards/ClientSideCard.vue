<script setup>
/** Carte client détaillée de la page Projets (livewire/cards/client_card_extended.blade.php). */
defineProps({
  client: { type: Object, required: true },
  tab: { type: String, default: 'projets' },
})
const emit = defineEmits(['edit', 'favorite', 'tab', 'logo'])

const tiles = [
  { key: 'projets', label: 'Projets', icon: 'ti-folder', count: 'projets_count' },
  { key: 'taches', label: 'Tâches', icon: 'ti-circle-check', count: 'tasks_count' },
  { key: 'contacts', label: 'Contacts', icon: 'ti-users', count: 'contacts_count' },
]
</script>

<template>
  <div class="card p-2">
    <div class="d-flex justify-content-between align-items-center mb-1">
      <button class="btn btn-icon rounded btn-primary" title="Modifier le client" @click="emit('edit')"><i class="ti ti-edit"></i></button>
      <button class="btn btn-icon btn-ghost-secondary" title="Changer le logo" @click="emit('logo')"><i class="ti ti-photo-edit"></i></button>
      <button
        class="btn btn-icon"
        :class="client.favorite ? 'btn-outline-danger' : 'btn-outline-secondary'"
        :title="client.favorite ? 'Supprimer des favoris' : 'Ajouter aux favoris'"
        @click="emit('favorite')"
      >
        <i :class="['ti', client.favorite ? 'ti-heart-filled' : 'ti-heart']"></i>
      </button>
    </div>
    <img :src="client.avatar" alt="" class="w-100 rounded-2" style="max-height: 150px; object-fit: contain" />
    <h2 class="text-center mt-1 mb-1">{{ client.name }}</h2>
    <div class="text-center text-secondary small mb-1">{{ client.type }}<span v-if="client.address"> · {{ client.address }}</span></div>
    <p v-if="client.description" class="description">{{ client.description }}</p>

    <div class="row g-2">
      <div v-for="t in tiles" :key="t.key" class="col-4">
        <div
          class="card card-sm h-100 text-center cursor-pointer"
          :class="{ 'bg-blue-lt border-primary': tab === t.key }"
          role="button"
          @click="emit('tab', t.key)"
        >
          <div class="card-body p-2">
            <div class="fs-2 fw-bold lh-1">{{ client[t.count] ?? '—' }}</div>
            <div class="my-1"><i :class="['ti', t.icon, 'fs-2']"></i></div>
            <div class="small fw-medium">{{ t.label }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.description {
  white-space: pre-line;
}
</style>
