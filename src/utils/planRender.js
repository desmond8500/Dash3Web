/**
 * Rendu des plans (image ou PDF via pdf.js), dessin des équipements placés,
 * et export en PDF annoté (jsPDF).
 */
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { jsPDF } from 'jspdf'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** Couleurs des systèmes (une par système, dans l'ordre) */
export const PALETTE = ['#206bc4', '#d63939', '#2fb344', '#f76707', '#ae3ec9', '#0ca678', '#f59f00', '#4263eb', '#d6336c', '#495057']

/**
 * Charge un plan à partir de son fichier (Blob).
 * @returns {Promise<{type:'image'|'pdf', pages:number, image?:HTMLImageElement, pdf?:any, url?:string}>}
 */
export async function loadPlan(blob) {
  const isPdf = blob.type === 'application/pdf' || (await blob.slice(0, 5).text()) === '%PDF-'
  if (isPdf) {
    const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise
    return { type: 'pdf', pages: pdf.numPages, pdf }
  }
  const url = URL.createObjectURL(blob)
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Impossible d'afficher l'image du plan"))
    img.src = url
  })
  return { type: 'image', pages: 1, image, url }
}

/** Taille naturelle d'une page (unités du document) */
export async function pageSize(doc, pageNo = 1) {
  if (doc.type === 'image') return { width: doc.image.naturalWidth, height: doc.image.naturalHeight }
  const page = await doc.pdf.getPage(pageNo)
  const vp = page.getViewport({ scale: 1 })
  return { width: vp.width, height: vp.height }
}

/** Dessine la page dans le canvas à l'échelle donnée ; renvoie la taille en pixels */
export async function renderPage(doc, pageNo, canvas, scale) {
  const ctx = canvas.getContext('2d')
  if (doc.type === 'image') {
    const w = Math.round(doc.image.naturalWidth * scale)
    const h = Math.round(doc.image.naturalHeight * scale)
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(doc.image, 0, 0, w, h)
    return { width: w, height: h }
  }
  const page = await doc.pdf.getPage(pageNo)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return { width: canvas.width, height: canvas.height }
}

// ---------- Icônes Tabler sur le canvas ----------
// Le caractère d'une icône (ti-camera → glyphe) est lu dans le CSS de la police
// (contenu ::before de la classe), puis mis en cache.
const glyphCache = new Map()
function tablerGlyph(cls) {
  if (!cls) return null
  if (glyphCache.has(cls)) return glyphCache.get(cls)
  let glyph = null
  try {
    const el = document.createElement('i')
    el.className = `ti ${cls}`
    el.style.position = 'absolute'
    el.style.visibility = 'hidden'
    document.body.appendChild(el)
    const content = getComputedStyle(el, '::before').content
    el.remove()
    if (content && content !== 'none' && content !== 'normal') {
      const str = content.replace(/^["']|["']$/g, '')
      if (str.length) glyph = str
    }
  } catch {
    glyph = null
  }
  glyphCache.set(cls, glyph)
  return glyph
}

/** Charge la police d'icônes avant un rendu canvas (sinon le premier glyphe sort en carré) */
export async function ensureIconFont() {
  try {
    await document.fonts.load('16px "tabler-icons"')
  } catch {
    /* la police manque : on retombera sur les numéros */
  }
}

/**
 * Dessine les repères (cercle de couleur + numéro ou icône de l'équipement + étiquette)
 * sur un canvas déjà rendu. Appeler ensureIconFont() avant pour avoir les icônes.
 */
export function drawMarkers(ctx, markers, width, height) {
  const r = Math.max(9, Math.round(Math.min(width, height) * 0.012))
  ctx.textBaseline = 'middle'
  for (const m of markers) {
    const x = m.x * width
    const y = m.y * height
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = m.color || PALETTE[0]
    ctx.fill()
    ctx.lineWidth = Math.max(2, r / 5)
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    // Icône de l'équipement (via les tags de l'article), sinon le numéro
    const glyph = tablerGlyph(m.icon)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    if (glyph) {
      ctx.font = `${Math.round(r * 1.25)}px "tabler-icons"`
      ctx.fillText(glyph, x, y + 1)
    } else {
      ctx.font = `bold ${Math.round(r * 1.05)}px sans-serif`
      ctx.fillText(String(m.number), x, y + 1)
    }

    // Avec une icône, le numéro passe dans l'étiquette pour garder le lien avec la légende
    const label = glyph ? `${m.number}.${m.label ? ` ${m.label}` : ''}` : m.label
    if (label) {
      ctx.font = `${Math.round(r * 1.1)}px sans-serif`
      ctx.textAlign = 'left'
      const tx = x + r + 4
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(tx - 2, y - r * 0.75, tw + 4, r * 1.5)
      ctx.fillStyle = '#1d273b'
      ctx.fillText(label, tx, y + 1)
    }
  }
}

/**
 * Exporte le plan annoté en PDF : une page par page du plan (avec les repères),
 * puis une légende (n°, équipement, type, système, caractéristiques).
 * @param {object} opts { doc, markers, legend: [{number, name, type, systeme, details, color}], title, filename }
 */
export async function exportAnnotatedPdf({ doc, markers, legend, title, filename }) {
  let pdf = null
  const canvas = document.createElement('canvas')
  await ensureIconFont()

  for (let p = 1; p <= doc.pages; p++) {
    const size = await pageSize(doc, p)
    // Rendu net : ~2400 px sur le grand côté
    const scale = Math.min(4, 2400 / Math.max(size.width, size.height))
    const { width, height } = await renderPage(doc, p, canvas, scale)
    drawMarkers(canvas.getContext('2d'), markers.filter((m) => (m.page || 1) === p), width, height)

    const orientation = width >= height ? 'landscape' : 'portrait'
    if (!pdf) pdf = new jsPDF({ orientation, unit: 'pt', format: 'a3' })
    else pdf.addPage('a3', orientation)

    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const margin = 24
    const header = 22
    const ratio = Math.min((pw - margin * 2) / width, (ph - margin * 2 - header) / height)
    pdf.setFontSize(12)
    pdf.text(`${title}${doc.pages > 1 ? ` — page ${p}/${doc.pages}` : ''}`, margin, margin + 8)
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin + header, width * ratio, height * ratio)
  }

  // Légende
  if (legend.length) {
    pdf.addPage('a4', 'portrait')
    const margin = 36
    let y = margin
    pdf.setFontSize(14)
    pdf.text(`Légende — ${title}`, margin, y)
    y += 22
    pdf.setFontSize(9)
    for (const row of legend) {
      if (y > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage('a4', 'portrait')
        y = margin
      }
      pdf.setFillColor(row.color || PALETTE[0])
      pdf.circle(margin + 6, y - 3, 6, 'F')
      pdf.setTextColor('#ffffff')
      pdf.text(String(row.number), margin + 6, y - 0.5, { align: 'center' })
      pdf.setTextColor('#1d273b')
      const head = [row.name, row.type, row.systeme].filter(Boolean).join(' · ')
      pdf.setFont(undefined, 'bold')
      pdf.text(head, margin + 18, y)
      pdf.setFont(undefined, 'normal')
      if (row.details) {
        const lines = pdf.splitTextToSize(row.details, pdf.internal.pageSize.getWidth() - margin * 2 - 18)
        pdf.text(lines, margin + 18, y + 11)
        y += 11 * lines.length
      }
      y += 18
    }
  }

  pdf.save(filename)
}
