<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)
const onScroll = () => {
  visible.value = window.scrollY > 300
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
</script>

<template>
  <Transition name="fade">
    <button v-if="visible" type="button" class="btn btn-primary btn-icon back-to-top shadow" title="Haut de page" aria-label="Revenir en haut de la page" @click="toTop">
      <i class="ti ti-arrow-up"></i>
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 1030;
  border-radius: 50%;
  width: 2.75rem;
  height: 2.75rem;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
