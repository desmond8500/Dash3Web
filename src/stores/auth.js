import { defineStore } from 'pinia'
import api, { TOKEN_KEY } from '@/api/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    displayName: (state) =>
      [state.user?.firstname, state.user?.lastname].filter(Boolean).join(' ') || state.user?.email || '',
  },

  actions: {
    async login(email, password) {
      const { data } = await api.post('/login', { email, password, device_name: 'dash3-web' })
      this.token = data.token
      this.user = data.user?.data ?? data.user
      localStorage.setItem(TOKEN_KEY, data.token)
    },

    async fetchMe() {
      const { data } = await api.get('/me')
      this.user = data.data ?? data
    },

    async logout() {
      try {
        if (this.token) await api.post('/logout')
      } finally {
        this.clear()
      }
    },

    clear() {
      this.token = null
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})
