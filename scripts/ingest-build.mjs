// INGESTION d'une soumission de build (déclenché par l'Action `.github/workflows/ingest-builds.yml`).
// Lit le corps de l'issue (env), extrait le code `WIB1:…`, le décode + valide (sans dépendance — base64
// UTF-8 + JSON), puis l'ajoute à `src/game/communityBuilds.json` (anti-doublon). Écrit le verdict dans
// $GITHUB_OUTPUT pour que l'Action commit/ferme l'issue ou commente l'erreur.
import fs from 'node:fs'

const FILE = 'src/game/communityBuilds.json'
const body = process.env.ISSUE_BODY || ''
const title = process.env.ISSUE_TITLE || ''
const author = (process.env.ISSUE_AUTHOR || '').trim()
const issue = Number(process.env.ISSUE_NUMBER || 0)

const setOut = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\r?\n/g, ' ')}\n`) }
const fail = (msg) => { setOut('result', 'invalid'); setOut('message', msg); console.log('INVALIDE :', msg); process.exit(0) }

// 1) Extraire le code WIB1: (robuste quel que soit le formatage de l'issue).
const m = body.match(/WIB1:[A-Za-z0-9+/=]+/)
if (!m) fail('Aucun code « WIB1:… » trouvé dans la soumission.')
const code = m[0]

// 2) Décoder + valider structurellement (pas de dépendance au moteur ici).
let cfg
try { cfg = JSON.parse(Buffer.from(code.replace(/^WIB1:/, ''), 'base64').toString('utf-8')) } catch { cfg = null }
if (!cfg || !Array.isArray(cfg.team) || cfg.team.length === 0 || !cfg.content) fail('Code invalide ou build vide.')
if (cfg.team.length > 3) fail('Équipe de plus de 3 membres — refusé.')
for (const t of cfg.team) { if (typeof t !== 'object' || (!t.cls && !t.imported)) fail('Membre d\'équipe mal formé.') }

// 3) Nom : titre de l'issue (« Build : X ») sinon noms d'équipe. Assaini (titre = saisie utilisateur) :
// retire les caractères dangereux pour le message de commit (shell) et le commentaire (JS template).
const rawName = title.replace(/^\s*Build\s*:\s*/i, '').trim() || cfg.team.map((t) => t.imported?.name ?? t.name).join(' + ')
const name = rawName.replace(/[`"$\\\r\n]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || `Build #${issue}`

// 4) Ajouter au catalogue (anti-doublon par code).
const list = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
if (list.some((b) => b.code === code)) { setOut('result', 'duplicate'); setOut('message', 'Ce build est déjà dans le catalogue.'); console.log('DOUBLON'); process.exit(0) }
list.push({ name, code, ...(author ? { by: author } : {}), addedAt: new Date().toISOString().slice(0, 10), issue })
fs.writeFileSync(FILE, JSON.stringify(list, null, 2) + '\n')

setOut('result', 'ok')
setOut('name', name)
setOut('total', String(list.length))
console.log(`AJOUTÉ : « ${name} » (#${issue}) — ${list.length} build(s) au catalogue.`)
