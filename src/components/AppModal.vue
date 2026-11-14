<script setup>
/**
 * Fenêtre modale Tabler pilotée par Vue (sans le JS Bootstrap), au format des
 * modales de Dash3 : titre, contenu, pied avec Fermer / Valider.
 */
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  size: { type: String, default: '' }, // '', 'modal-lg', 'modal-sm'
  saving: { type: Boolean, default: false },
  submitLabel: { type: String, default: 'Valider' },
  canSubmit: { type: Boolean, default: true },
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])
</script>

<template>
  <Teleport to="body">
    <template v-if="show">
      <div class="modal modal-blur d-block" tabindex="-1" role="dialog" @click.self="emit('close')" @keydown.esc="emit('close')">
        <div class="modal-dialog modal-dialog-centered" :class="size" role="document">
          <form class="modal-content" @submit.prevent="emit('submit')">
            <div class="modal-header">
              <h5 class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" aria-label="Fermer" @click="emit('close')"></button>
            </div>
            <div class="modal-body">
              <div v-if="error" class="alert alert-danger">{{ error }}</div>
              <slot />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="emit('close')">Fermer</button>
              <button type="submit" class="btn btn-primary" :disabled="saving || !canSubmit">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>{{ submitLabel }}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    </template>
  </Teleport>
</template>
