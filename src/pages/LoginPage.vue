<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/client'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    router.push(route.query.redirect || { name: 'dashboard' })
  } catch (e) {
    error.value =
      e.response?.status === 429 ? 'Trop de tentatives, réessayez dans une minute.' : errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page page-center">
    <div class="container container-tight py-4">
      <div class="text-center mb-4">
        <img src="/logo.svg" alt="" width="64" height="64" class="mb-2" />
        <h1 class="h1 fw-bold">Dash3</h1>
      </div>
      <div class="card card-md">
        <div class="card-body">
          <h2 class="h2 text-center mb-4">Connexion à votre compte</h2>

          <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

          <form autocomplete="on" novalidate @submit.prevent="submit">
            <div class="mb-3">
              <label class="form-label" for="email">Adresse e-mail</label>
              <input id="email" v-model.trim="email" type="email" class="form-control" placeholder="vous@exemple.com" autocomplete="username" required />
            </div>
            <div class="mb-2">
              <label class="form-label" for="password">Mot de passe</label>
              <div class="input-group input-group-flat">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-control"
                  placeholder="Votre mot de passe"
                  autocomplete="current-password"
                  required
                />
                <span class="input-group-text">
                  <a href="#" class="link-secondary" :title="showPassword ? 'Masquer' : 'Afficher'" @click.prevent="showPassword = !showPassword">
                    <i :class="['ti', showPassword ? 'ti-eye-off' : 'ti-eye']"></i>
                  </a>
                </span>
              </div>
            </div>
            <div class="form-footer">
              <button type="submit" class="btn btn-primary w-100" :disabled="loading || !email || !password">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
                Se connecter
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
