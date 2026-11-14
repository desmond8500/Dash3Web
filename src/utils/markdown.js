/**
 * Mini rendu Markdown sûr (sans dépendance) pour les sections de journal :
 * le texte est d'abord échappé, puis un sous-ensemble de Markdown est converti.
 * Pris en charge : # titres, **gras**, *italique*, `code`, [lien](url),
 * listes - et 1., > citation, lignes vides = paragraphes.
 */
const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

export function renderMarkdown(src) {
  if (!src) return ''
  const lines = escapeHtml(src).replace(/\r\n/g, '\n').split('\n')
  const out = []
  let list = null // 'ul' | 'ol'
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const ul = line.match(/^[-*]\s+(.*)$/)
    const ol = line.match(/^\d+[.)]\s+(.*)$/)
    const quote = line.match(/^&gt;\s?(.*)$/)
    if (h) {
      closeList()
      const level = Math.min(h[1].length + 2, 6) // # → h3 (sous le titre de section)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
    } else if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`)
    } else if (quote) {
      closeList()
      out.push(`<blockquote class="text-secondary border-start ps-2">${inline(quote[1])}</blockquote>`)
    } else if (!line.trim()) {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join('\n')
}
