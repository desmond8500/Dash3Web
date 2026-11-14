<script setup>
/** Éditeur markdown simple : barre d'outils, saisie et aperçu. */
import { ref } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const model = defineModel({ type: String, default: '' })
defineProps({ rows: { type: Number, default: 8 }, placeholder: { type: String, default: '' } })

const area = ref(null)
const preview = ref(false)

/** Entoure la sélection (gras, italique, code) ou insère un préfixe de ligne (titre, liste, citation) */
function apply(before, after = '', linePrefix = null) {
  const el = area.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const text = model.value ?? ''
  if (linePrefix) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    model.value = text.slice(0, lineStart) + linePrefix + text.slice(lineStart)
    requestAnimationFrame(() => el.setSelectionRange(start + linePrefix.length, end + linePrefix.length))
    return
  }
  const selected = text.slice(start, end) || 'texte'
  model.value = text.slice(0, start) + before + selected + after + text.slice(end)
  requestAnimationFrame(() => el.setSelectionRange(start + before.length, start + before.length + selected.length))
}

const tools = [
  { icon: 'ti-bold', title: 'Gras', run: () => apply('**', '**') },
  { icon: 'ti-italic', title: 'Italique', run: () => apply('*', '*') },
  { icon: 'ti-code', title: 'Code', run: () => apply('`', '`') },
  { icon: 'ti-h-1', title: 'Titre', run: () => apply('', '', '# ') },
  { icon: 'ti-list', title: 'Liste', run: () => apply('', '', '- ') },
  { icon: 'ti-list-numbers', title: 'Liste numérotée', run: () => apply('', '', '1. ') },
  { icon: 'ti-quote', title: 'Citation', run: () => apply('', '', '> ') },
  { icon: 'ti-link', title: 'Lien', run: () => apply('[', '](https://)') },
]
</script>

<template>
  <div class="md-editor border rounded">
    <div class="d-flex align-items-center gap-1 p-1 border-bottom bg-light flex-wrap">
      <button v-for="t in tools" :key="t.icon" type="button" class="btn btn-sm btn-icon btn-ghost-secondary" :title="t.title" @click="t.run">
        <i :class="['ti', t.icon]"></i>
      </button>
      <button type="button" class="btn btn-sm ms-auto" :class="preview ? 'btn-primary' : 'btn-ghost-secondary'" @click="preview = !preview">
        <i class="ti ti-eye"></i> Aperçu
      </button>
    </div>
    <textarea v-show="!preview" ref="area" v-model="model" class="form-control border-0" :rows="rows" :placeholder="placeholder"></textarea>
    <!-- eslint-disable-next-line vue/no-v-html -- rendu par renderMarkdown, qui échappe le texte -->
    <div v-show="preview" class="md-preview p-2" v-html="renderMarkdown(model)"></div>
  </div>
</template>

<style scoped>
.md-editor textarea {
  border-radius: 0;
  resize: vertical;
  font-family: var(--tblr-font-monospace, monospace);
  font-size: 0.875rem;
}
.md-preview {
  min-height: 6rem;
}
.md-preview :deep(p:last-child) {
  margin-bottom: 0;
}
.md-preview :deep(img) {
  max-width: 100%;
}
</style>
