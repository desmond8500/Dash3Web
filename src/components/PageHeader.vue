<script setup>
defineProps({
  title: { type: String, required: true },
  pretitle: { type: String, default: '' },
})
</script>

<template>
  <div class="page-header d-print-none">
    <div class="container-xl">
      <div class="row g-2 align-items-center">
        <div class="col">
          <div v-if="pretitle" class="page-pretitle">{{ pretitle }}</div>
          <h2 class="page-title">{{ title }}</h2>
        </div>
        <div class="col-auto ms-auto d-print-none">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>
