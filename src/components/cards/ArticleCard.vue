<script setup>
/** Carte article, reprise de resources/views/_card/articleCard.blade.php (Dash3). */
defineProps({ article: { type: Object, required: true } })
const emit = defineEmits(['edit', 'duplicate', 'delete', 'brand', 'provider'])

const price = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n || 0)) + ' F'
</script>

<template>
  <div class="card p-2">
    <div class="row g-2">
      <div class="col-auto">
        <img :src="article.image" alt="" class="avatar avatar-xl rounded-2 p-1 bg-white" style="object-fit: contain; max-height: 100px" />
      </div>
      <div class="col">
        <div class="row">
          <div class="col">
            <div class="border-bottom pb-2 title">
              <span class="fw-bold">{{ article.designation }}</span>
            </div>
          </div>
          <div class="col-auto">
            <div class="dropdown">
              <button class="btn btn-ghost-primary btn-icon" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
                <i class="ti ti-dots-vertical"></i>
              </button>
              <div class="dropdown-menu dropdown-menu-end">
                <button class="dropdown-item" type="button" @click="emit('edit', article)"><i class="ti ti-edit"></i> Éditer</button>
                <button class="dropdown-item" type="button" @click="emit('duplicate', article)"><i class="ti ti-copy"></i> Dupliquer</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item text-danger" type="button" @click="emit('delete', article)"><i class="ti ti-trash"></i> Supprimer</button>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-8">
            <div class="text-muted" title="Référence" style="font-size: 10px">{{ (article.reference || '').toUpperCase() }}</div>
            <div v-if="article.brand_name" class="text-muted" title="Marque">
              <a href="#" class="text-muted" @click.prevent="emit('brand', article.brand_id)">{{ article.brand_name }}</a>
            </div>
            <div v-if="article.provider_name" title="Fournisseur" style="font-size: 12px">
              <a href="#" class="badge bg-blue-lt" @click.prevent="emit('provider', article.provider_id)">{{ article.provider_name }}</a>
            </div>
          </div>
          <div class="col-4">
            <div class="text-end mt-2 me-2" style="font-size: 20px" title="Quantité">{{ article.quantity ?? 0 }}</div>
          </div>
        </div>

        <div class="row mt-1">
          <div class="col-6">
            <div class="badge" style="font-size: 10px" title="Priorité">{{ article.priority }}</div>
          </div>
          <div class="col-6">
            <div class="text-danger text-end" style="font-size: 18px">{{ price(article.price) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title {
  min-height: 20px;
  max-height: 45px;
  overflow: hidden;
}
</style>
