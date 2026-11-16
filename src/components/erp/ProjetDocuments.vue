<script setup>
/** Documents d'un projet (catalogues, flyers, plan d'accès…), voir DocumentsManager */
import {
  deleteProjetDocument,
  downloadProjetDocument,
  projetDocuments,
  updateProjetDocument,
  uploadProjetDocument,
} from '@/api/dash3'
import DocumentsManager from '@/components/erp/DocumentsManager.vue'

const props = defineProps({ projetId: { type: [String, Number], required: true } })
const emit = defineEmits(['changed'])
</script>

<template>
  <DocumentsManager
    :fetch="() => projetDocuments(props.projetId)"
    :upload="(file, category) => uploadProjetDocument(props.projetId, file, '', category)"
    :update="updateProjetDocument"
    :remove="(d) => deleteProjetDocument(d.id)"
    :download="downloadProjetDocument"
    @changed="(n) => emit('changed', n)"
  />
</template>
