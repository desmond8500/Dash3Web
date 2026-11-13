import { ref, watch } from 'vue'
import api, { normalizeList, errorMessage } from '@/api/client'

/**
 * Charge une liste paginée depuis l'API Dash3, avec recherche.
 * @param {string} endpoint  ex. '/clients'
 * @param {object} extraParams  paramètres fixes (per_page…)
 */
export function usePaginatedList(endpoint, extraParams = {}) {
  const items = ref([])
  const page = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const search = ref('')
  const loading = ref(false)
  const error = ref('')

  async function load(p = page.value) {
    loading.value = true
    error.value = ''
    try {
      const { data } = await api.get(endpoint, {
        params: { ...extraParams, page: p, search: search.value || undefined },
      })
      const list = normalizeList(data)
      items.value = list.items
      page.value = list.page
      lastPage.value = list.lastPage
      total.value = list.total
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  let timer
  watch(search, () => {
    clearTimeout(timer)
    timer = setTimeout(() => load(1), 300)
  })

  return { items, page, lastPage, total, search, loading, error, load }
}
