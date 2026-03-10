import './App.css'
import { useState, useEffect } from 'react'
import { useAppState } from './state/AppStateContext'

function App() {
  const { ui, schemaOk } = useAppState()
  const [selectedEleveId, setSelectedEleveId] = useState<number | null>(null)

  return (
    <div className={`app-root app-theme-${ui.theme} ${ui.compactMode ? 'app-compact' : ''}`}>
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">Composition Chambre</h1>
          <div className="app-subtitle">Préparation des chambres pour le voyage scolaire</div>
          <div className="app-version" title="Commit Git du build déployé">
            Version <code>{__GIT_VERSION__}</code>
          </div>
        </div>
        <div className="app-header-right">
          <GristApiStatus />
          <SyncIndicator />
          <ThemeToggle />
          <CompactToggle />
          <DebugToggle />
        </div>
      </header>
      {ui.errorMessage && (
        <div className="app-banner app-banner-error">
          <span>{ui.errorMessage}</span>
        </div>
      )}
      {ui.readOnly && !ui.errorMessage && (
        <div className="app-banner app-banner-warning">
          <span>Mode lecture seule détecté : les modifications ne seront pas enregistrées.</span>
        </div>
      )}
      <main className="app-main">
        <section className="sidebar">
          <StudentsPanel
            selectedEleveId={selectedEleveId}
            onSelectEleve={(id) => setSelectedEleveId(id)}
          />
        </section>
        <section className="canvas-section">
          {schemaOk ? (
            <GroupsCanvas
              selectedEleveId={selectedEleveId}
              onEleveAssigned={() => setSelectedEleveId(null)}
            />
          ) : (
            <div className="panel canvas-panel">
              <div className="panel-header">
                <h2>Groupes</h2>
              </div>
              <div className="empty-state">
                Schéma Grist incomplet. Corrigez la configuration des tables pour utiliser ce
                widget.
              </div>
            </div>
          )}
        </section>
        <section className="rooms-section">
          {schemaOk ? (
            <>
              <RoomsPanel />
              <ExportPanel />
            </>
          ) : (
            <div className="panel rooms-panel">
              <div className="panel-header">
                <h2>Chambres</h2>
              </div>
              <div className="empty-state">
                Schéma Grist incomplet. Corrigez la configuration des tables pour utiliser ce
                widget.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function GristApiStatus() {
  const { ui } = useAppState()
  const [gristPresent, setGristPresent] = useState<boolean | null>(null)

  useEffect(() => {
    if (!ui.debug.enabled) return
    setGristPresent(typeof window !== 'undefined' && !!window.grist)
  }, [ui.debug.enabled])

  if (!ui.debug.enabled) return null
  return (
    <span className="grist-api-status" title="État de l’API Grist (visible en mode Debug)">
      {gristPresent === null ? '…' : gristPresent ? 'API Grist détectée' : 'API Grist absente (mode démo)'}
    </span>
  )
}

function SyncIndicator() {
  const { ui } = useAppState()
  return (
    <div className="sync-indicator" title="Synchronisation avec Grist">
      <span className={`sync-dot ${ui.isSyncing ? 'sync-dot-syncing' : 'sync-dot-ok'}`} />
      <span className="sync-label">{ui.isSyncing ? 'Synchronisation…' : 'À jour'}</span>
    </div>
  )
}

function ThemeToggle() {
  const { ui, setTheme } = useAppState()
  const nextTheme = ui.theme === 'light' ? 'dark' : 'light'
  return (
    <button
      type="button"
      className="toolbar-button"
      onClick={() => setTheme(nextTheme)}
      aria-label="Basculer le thème clair/sombre"
    >
      {ui.theme === 'light' ? '☀️' : '🌙'}
    </button>
  )
}

function CompactToggle() {
  const { ui, toggleCompactMode } = useAppState()
  return (
    <button
      type="button"
      className="toolbar-button"
      onClick={toggleCompactMode}
      aria-pressed={ui.compactMode}
    >
      Mode compact
    </button>
  )
}

function DebugToggle() {
  const { ui, toggleDebug } = useAppState()
  return (
    <button
      type="button"
      className="toolbar-button"
      onClick={toggleDebug}
      aria-pressed={ui.debug.enabled}
    >
      Debug
    </button>
  )
}

interface StudentsPanelProps {
  selectedEleveId: number | null
  onSelectEleve: (id: number | null) => void
}

function StudentsPanel({ selectedEleveId, onSelectEleve }: StudentsPanelProps) {
  const { eleves, elevesSansGroupe, ui, gristDebugInfo } = useAppState()
  const cinqPremiers = eleves.slice(0, 5)
  return (
    <div className="panel students-panel">
      <div className="panel-header">
        <h2>Élèves non groupés</h2>
        <div className="panel-subtitle">{elevesSansGroupe.length} élèves</div>
      </div>
      {ui.debug.enabled && (
        <div className="debug-five-eleves">
          <div className="debug-five-title">
            Debug – 5 premiers élèves reçus (total : {eleves.length})
          </div>
          {gristDebugInfo && (
            <div className="debug-grist-tables">
              <div className="debug-grist-row">
                <strong>Tables reçues de Grist :</strong>{' '}
                {gristDebugInfo.tableNames.length === 0 ? (
                  <span className="debug-warn">aucune (vérifier Full document access)</span>
                ) : (
                  <code>{gristDebugInfo.tableNames.join(', ')}</code>
                )}
              </div>
              {!gristDebugInfo.tableNames.includes('Eleve') && gristDebugInfo.tableNames.length > 0 && (
                <div className="debug-grist-row debug-warn">
                  La table attendue s’appelle exactement <code>Eleve</code> (sans « s », sans accent).
                  Renommez la table dans Grist ou adaptez le mapping.
                </div>
              )}
              {gristDebugInfo.tableNames.includes('Eleve') && (
                <div className="debug-grist-row">
                  Table <code>Eleve</code> : <strong>{gristDebugInfo.eleveRowCount} lignes</strong>.
                  Colonnes reçues : <code>{gristDebugInfo.eleveColumns.join(', ')}</code>. Attendues :
                  id, Nom, Prenom, Classe, Groupe.
                </div>
              )}
            </div>
          )}
          {cinqPremiers.length === 0 ? (
            <div className="debug-five-empty">
              Aucun élève affiché. Vérifier le nom de la table <code>Eleve</code>, les colonnes Nom
              / Prenom / Classe / Groupe (exactement ces noms), et l’accès du widget (Full document
              access).
            </div>
          ) : (
            <ul className="debug-five-list">
              {cinqPremiers.map((e) => (
                <li key={e.id}>
                  {e.prenom} {e.nom} · {e.classe} · Groupe id: {e.groupeId ?? '—'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="students-filters">
        <input
          type="search"
          className="input"
          placeholder="Rechercher un élève…"
          // TODO: état contrôlé + filtrage
        />
        <select className="input">
          <option value="">Toutes les classes</option>
        </select>
      </div>
      <div className="students-list">
        {elevesSansGroupe.map((e) => (
          <div
            key={e.id}
            className={`student-card ${selectedEleveId === e.id ? 'student-card-selected' : ''}`}
            draggable={!ui.readOnly}
            onClick={() => onSelectEleve(selectedEleveId === e.id ? null : e.id)}
            onDragStart={(evt) => {
              if (ui.readOnly) return
              evt.dataTransfer.setData('text/plain', `student:${e.id}`)
            }}
          >
            <div className="student-name">
              {e.prenom} {e.nom}
            </div>
            <div className="student-meta">{e.classe}</div>
          </div>
        ))}
        {elevesSansGroupe.length === 0 && (
          <div className="empty-state">Tous les élèves sont dans un groupe.</div>
        )}
      </div>
    </div>
  )
}

interface GroupsCanvasProps {
  selectedEleveId: number | null
  onEleveAssigned: () => void
}

function GroupsCanvas({ selectedEleveId, onEleveAssigned }: GroupsCanvasProps) {
  const { groupesAvecEleves, moveEleveToGroupe, ui } = useAppState()
  return (
    <div className="panel canvas-panel">
      <div className="panel-header">
        <h2>Groupes</h2>
      </div>
      <div className="canvas">
        {groupesAvecEleves.map((g) => (
          <div
            key={g.id}
            className="group-card"
            style={{ borderColor: g.couleur, backgroundColor: `${g.couleur}20` }}
            draggable={!ui.readOnly}
            onDoubleClick={async () => {
              if (ui.readOnly) return
              if (selectedEleveId != null) {
                await moveEleveToGroupe(selectedEleveId, g.id)
                onEleveAssigned()
              }
            }}
            onDragOver={(evt) => {
              // Permettre le drop d’un élève (sauf en lecture seule).
              if (ui.readOnly) return
              evt.preventDefault()
            }}
            onDrop={async (evt) => {
              if (ui.readOnly) return
              const data = evt.dataTransfer.getData('text/plain')
              if (data.startsWith('student:')) {
                const id = Number(data.split(':')[1])
                if (!Number.isNaN(id)) {
                  await moveEleveToGroupe(id, g.id)
                  onEleveAssigned()
                }
              }
            }}
            onDragStart={(evt) => {
              // Déplacement du groupe vers une chambre.
              evt.dataTransfer.setData('text/plain', `group:${g.id}`)
            }}
          >
            <div className="group-header">
              <span className="group-title">Groupe {g.numGroupe}</span>
              <span className="group-count">{g.eleves.length} él.</span>
            </div>
            <div className="group-body">
              {g.eleves.map((e) => (
                <span key={e.id} className="group-student-pill">
                  {e.prenom}
                </span>
              ))}
              {g.eleves.length === 0 && (
                <span className="group-empty">Déposez des élèves ici</span>
              )}
            </div>
          </div>
        ))}
        {groupesAvecEleves.length === 0 && (
          <div className="empty-state">
            Aucun groupe pour l’instant. Créez des groupes depuis Grist ou ajoutez un bouton dédié
            dans une prochaine version.
          </div>
        )}
      </div>
    </div>
  )
}

function RoomsPanel() {
  const { chambresAvecStats, moveGroupeToChambre, ui } = useAppState()
  return (
    <div className="panel rooms-panel">
      <div className="panel-header">
        <h2>Chambres</h2>
        {!ui.hasGroupRoomLink && (
          <div className="panel-subtitle">
            Colonne <code>Chambre</code> absente dans la table <code>Groupe</code> : dépôt de
            groupes désactivé.
          </div>
        )}
      </div>
      <div className="rooms-list">
        {chambresAvecStats.map((c) => {
          const full = c.capaciteRestante === 0
          return (
            <div
              key={c.id}
              className={`room-card ${full ? 'room-full' : 'room-available'} ${
                ui.hasGroupRoomLink ? '' : 'room-disabled'
              }`}
              draggable={false}
              onDragOver={(evt) => {
                // Permettre le drop de groupe uniquement si la colonne Groupe.Chambre existe
                // et que l'utilisateur a le droit de modifier.
                if (!ui.hasGroupRoomLink || ui.readOnly) return
                evt.preventDefault()
              }}
              onDrop={async (evt) => {
                if (!ui.hasGroupRoomLink || ui.readOnly) return
                const data = evt.dataTransfer.getData('text/plain')
                if (data.startsWith('group:')) {
                  const id = Number(data.split(':')[1])
                  if (!Number.isNaN(id)) {
                    await moveGroupeToChambre(id, c.id)
                  }
                }
              }}
            >
              <div className="room-header">
                <span className="room-name">{c.nomChambre}</span>
              </div>
              <div className="room-meta">
                Capacité {c.capacite} ·{' '}
                {full ? 'Complet' : `${c.capaciteRestante} places restantes`}
              </div>
            </div>
          )
        })}
        {chambresAvecStats.length === 0 && (
          <div className="empty-state">
            Aucune chambre trouvée. Vérifiez la table <code>Chambre</code> dans Grist.
          </div>
        )}
      </div>
    </div>
  )
}

function ExportPanel() {
  const { groupesAvecEleves, chambresAvecStats, ui } = useAppState()

  const lines: string[] = []
  if (ui.hasGroupRoomLink) {
    for (const chambre of chambresAvecStats) {
      lines.push(`Chambre ${chambre.nomChambre} (capacité ${chambre.capacite})`)
      const groupesDansChambre = groupesAvecEleves.filter((g) => g.chambreId === chambre.id)
      for (const g of groupesDansChambre) {
        const elevesNoms = g.eleves.map((e) => `${e.prenom} ${e.nom}`).join(', ')
        lines.push(`  Groupe ${g.numGroupe}: ${elevesNoms}`)
      }
      lines.push('')
    }
  }
  const exportText = lines.join('\n')

  return (
    <div className="panel export-panel">
      <div className="panel-header">
        <h2>Export (aperçu)</h2>
      </div>
      <textarea
        className="export-textarea"
        readOnly
        value={
          ui.hasGroupRoomLink
            ? exportText ||
              'Aucune chambre ou groupe assigné pour le moment.\nLes données apparaîtront ici une fois les groupes placés dans les chambres.'
            : 'La colonne "Chambre" dans la table "Groupe" est absente.\nAjoutez-la pour obtenir un export par chambre.'
        }
      />
    </div>
  )
}

export default App
