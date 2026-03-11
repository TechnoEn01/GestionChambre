/** Palette de couleurs proposées pour les groupes (hex #rrggbb). */
export const GROUP_COLORS_PALETTE: string[] = [
  '#4f46e5', // indigo
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#db2777', // pink
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#65a30d', // lime
  '#ea580c', // orange
  '#0d9488', // teal
]

/** Normalise une couleur hex (avec ou sans #) en minuscules avec #. */
function normalizeHex(hex: string): string {
  const s = hex.trim().replace(/^#/, '').toLowerCase()
  return s.length === 6 ? `#${s}` : ''
}

/**
 * Retourne une couleur de la palette qui n'est pas dans usedHexColors.
 * Si toutes sont utilisées, retourne la première de la palette.
 */
export function pickUnusedGroupColor(usedHexColors: string[]): string {
  const used = new Set(
    usedHexColors
      .map(normalizeHex)
      .filter((h) => h.length === 6),
  )
  const fallback = GROUP_COLORS_PALETTE[0] ?? '#4f46e5'
  for (const c of GROUP_COLORS_PALETTE) {
    const n = normalizeHex(c)
    if (n && !used.has(n)) return n
  }
  return fallback
}

/**
 * Couleur pour un nouveau groupe : première non utilisée, ou par index si les
 * groupes existants ont tous la même couleur (ex. colonne Couleur absente dans Grist).
 */
export function getNewGroupColor(
  existingGroupCount: number,
  usedHexColors: string[],
): string {
  const used = usedHexColors.map(normalizeHex).filter((h) => h.length === 6)
  const allSame = used.length > 0 && used.every((h) => h === used[0])
  if (allSame) {
    return GROUP_COLORS_PALETTE[existingGroupCount % GROUP_COLORS_PALETTE.length] ?? GROUP_COLORS_PALETTE[0]!
  }
  return pickUnusedGroupColor(usedHexColors)
}
