/**
 * CODE DE BUILD PARTAGEABLE — fonction PURE (réutilisée par l'app, le banc d'essai `builds-bench.mjs`
 * et l'ingestion GitHub `scripts/ingest-build.mjs`). Un `SimConfig` complet (compo + tous les loadouts,
 * y compris un perso importé entièrement sérialisé) encodé en base64 UTF-8, préfixé `WIB1:`. Autonome
 * → reproductible partout sans sauvegarde. Aucune dépendance à React/au store (respecte la règle d'or).
 */
import type { SimConfig } from './simulator'

export const BUILD_CODE_PREFIX = 'WIB1:'

/** Encode un build en code partageable `WIB1:…`. */
export function encodeBuild(cfg: SimConfig): string {
  return BUILD_CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(cfg))))
}

/** Décode un code de build. Retourne `null` si le code est invalide (pas un SimConfig plausible). */
export function decodeBuild(code: string): SimConfig | null {
  try {
    const raw = code.trim().replace(/^WIB1:/, '')
    const cfg = JSON.parse(decodeURIComponent(escape(atob(raw))))
    return cfg && Array.isArray(cfg.team) && cfg.content ? (cfg as SimConfig) : null
  } catch {
    return null
  }
}
