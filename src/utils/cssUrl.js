/**
 * Valeur CSS « url("…") » sûre pour background-image : sans guillemets ni encodage,
 * une URL contenant un espace ou une parenthèse (« photo (1).jpg ») est ignorée par le navigateur.
 */
export function cssUrl(url) {
  if (!url) return 'none'
  let safe = url
  try {
    safe = encodeURI(decodeURI(url))
  } catch {
    safe = encodeURI(url)
  }
  return `url("${safe.replace(/["\\]/g, '\\$&').replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))}")`
}
