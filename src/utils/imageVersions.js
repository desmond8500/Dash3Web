/**
 * Une image modifiée sur le serveur garde la même URL (le fichier est remplacé) :
 * sans précaution, le navigateur continuerait d'afficher l'ancienne version en cache.
 * On retient ici la version (date de modification) de chaque image éditée et on
 * l'ajoute (?v=…) aux URL renvoyées par l'API (voir l'intercepteur dans api/client.js).
 */
const KEY = 'dash3.imageVersions'
const MAX_ENTRIES = 300

let versions = load()

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function persist() {
  try {
    const entries = Object.entries(versions)
    if (entries.length > MAX_ENTRIES) {
      versions = Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES))
    }
    localStorage.setItem(KEY, JSON.stringify(versions))
  } catch {
    /* stockage indisponible : la version reste en mémoire pour cette session */
  }
}

/** « https://…/storage/a/b.png?v=1 » → « a/b.png » (ou null si ce n'est pas une image du stockage) */
export function storagePath(url) {
  if (typeof url !== 'string') return null
  const i = url.indexOf('/storage/')
  if (i === -1) return null
  const path = url.slice(i + '/storage/'.length).split(/[?#]/)[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** À appeler après une édition réussie (path relatif au disque public, version = mtime) */
export function markImageEdited(path, version = Date.now()) {
  if (!path) return
  versions[path] = version
  persist()
}

/** Ajoute ?v=… à l'URL si l'image a été modifiée depuis cette application */
export function withVersion(url) {
  const path = storagePath(url)
  const v = path && versions[path]
  if (!v) return url
  const base = url.replace(/([?&])v=[^&#]*&?/, '$1').replace(/[?&]$/, '')
  return `${base}${base.includes('?') ? '&' : '?'}v=${v}`
}

const IMAGE_URL = /^https?:\/\/.+\/storage\/.+\.(jpe?g|png|webp|gif|bmp|avif)(\?.*)?$/i

/** Parcourt une réponse JSON et met à jour les URL d'images modifiées */
export function bustImageUrls(data) {
  if (!Object.keys(versions).length || data === null || typeof data !== 'object') return data
  const walk = (value) => {
    if (typeof value === 'string') return IMAGE_URL.test(value) ? withVersion(value) : value
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = walk(value[i])
      return value
    }
    if (value && typeof value === 'object') {
      for (const k of Object.keys(value)) value[k] = walk(value[k])
    }
    return value
  }
  return walk(data)
}
