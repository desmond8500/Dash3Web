<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  lastPage: { type: Number, required: true },
  total: { type: Number, default: 0 },
})
const emit = defineEmits(['change'])

function go(p) {
  if (p >= 1 && p <= props.lastPage && p !== props.page) emit('change', p)
}
</script>

<template>
  <div class="card-footer d-flex align-items-center">
    <p class="m-0 text-secondary">{{ total }} élément(s) — page {{ page }} / {{ lastPage }}</p>
    <ul class="pagination m-0 ms-auto">
      <li class="page-item" :class="{ disabled: page <= 1 }">
        <a class="page-link" href="#" @click.prevent="go(page - 1)"><i class="ti ti-chevron-left"></i> Préc.</a>
      </li>
      <li class="page-item" :class="{ disabled: page >= lastPage }">
        <a class="page-link" href="#" @click.prevent="go(page + 1)">Suiv. <i class="ti ti-chevron-right"></i></a>
      </li>
    </ul>
  </div>
</template>
