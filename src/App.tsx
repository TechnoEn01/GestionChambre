import './App.css'
import { useState, useEffect, useMemo } from 'react'
import { useAppState } from './state/AppStateContext'

type AppPage = 'eleves-groupes' | 'groupes-chambres'

function App() {
  const { ui, schemaOk } = useAppState()
  const [selectedEleveId, setSelectedEleveId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState<AppPage>('eleves-groupes')

  return (
    <div className={`app-root app-theme-${ui.theme} ${ui.compactMode ? 'app-compact' : ''}`}>
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">Composition Chambre</h1>
          <div className="app-subtitle">
            {currentPage === 'eleves-groupes'
              ? 'Affecter les élèves aux groupes'
              : 'Composer les chambres'}
          </div>
          {ui.debug.enabled && (
            <div className="app-version" title="Commit Git du build déployé">
              Version <code>{__GIT_VERSION__}</code>
            </div>
          )}
        </div>
        <div className="app-header-right">
          <GristApiStatus />
          <SyncIndicator />
          <ThemeToggle />
          <CompactToggle />
          <DebugToggle />
        </div>
      </header>
      <nav className="app-nav">
        <button
          type="button"
          className={`app-nav-tab ${currentPage === 'eleves-groupes' ? 'app-nav-tab-active' : ''}`}
          onClick={() => setCurrentPage('eleves-groupes')}
        >
          Élèves → Groupes
        </button>
        <button
          type="button"
          className={`app-nav-tab ${currentPage === 'groupes-chambres' ? 'app-nav-tab-active' : ''}`}
          onClick={() => setCurrentPage('groupes-chambres')}
        >
          Groupes → Chambres
        </button>
      </nav>
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
      {currentPage === 'eleves-groupes' && (
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
                mode="eleves-groupes"
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
          <section className="rooms-section rooms-section-preview">
            <div className="panel">
              <div className="panel-header">
                <h2>Étape suivante</h2>
              </div>
              <div className="empty-state">
                Une fois les élèves répartis dans les groupes, passez à l’onglet{' '}
                <strong>Groupes → Chambres</strong> pour affecter chaque groupe à une chambre.
              </div>
            </div>
          </section>
        </main>
      )}
      {currentPage === 'groupes-chambres' && (
        <main className="app-main app-main-groupes-chambres">
          <UnassignedStudentsBanner onGoToElevesGroupes={() => setCurrentPage('eleves-groupes')} />
          <section className="sidebar groupes-sidebar">
            {schemaOk ? (
              <GroupsCanvas
                selectedEleveId={null}
                onEleveAssigned={() => {}}
                mode="groupes-chambres"
              />
            ) : (
              <div className="panel canvas-panel">
                <div className="panel-header">
                  <h2>Groupes</h2>
                </div>
                <div className="empty-state">Schéma Grist incomplet.</div>
              </div>
            )}
          </section>
          <section className="rooms-section rooms-section-full">
            {schemaOk ? (
              <RoomsPanel />
            ) : (
              <div className="panel rooms-panel">
                <div className="panel-header">
                  <h2>Chambres</h2>
                </div>
                <div className="empty-state">Schéma Grist incomplet.</div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  )
}

function UnassignedStudentsBanner({ onGoToElevesGroupes }: { onGoToElevesGroupes: () => void }) {
  const { elevesSansGroupe } = useAppState()
  if (elevesSansGroupe.length === 0) return null
  return (
    <div className="app-banner app-banner-info">
      <span>
        {elevesSansGroupe.length} élève(s) sans groupe. Affectez-les d’abord à un groupe dans
        l’onglet <button type="button" className="app-nav-inline" onClick={onGoToElevesGroupes}>Élèves → Groupes</button>.
      </span>
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
      className={`toolbar-button ${ui.compactMode ? 'toolbar-button-active' : ''}`}
      onClick={toggleCompactMode}
      aria-pressed={ui.compactMode}
      title={ui.compactMode ? 'Désactiver le mode compact' : 'Activer le mode compact'}
    >
      Mode compact {ui.compactMode ? '✓' : ''}
    </button>
  )
}

function DebugToggle() {
  const { ui, toggleDebug } = useAppState()
  return (
    <button
      type="button"
      className={`toolbar-button ${ui.debug.enabled ? 'toolbar-button-active' : ''}`}
      onClick={toggleDebug}
      aria-pressed={ui.debug.enabled}
      title={ui.debug.enabled ? 'Désactiver le mode debug' : 'Activer le mode debug'}
    >
      Mode debug {ui.debug.enabled ? '✓' : ''}
    </button>
  )
}

/** Affiche le nom d’un élève : complet (Prénom Nom) ou court (5 premières lettres du nom + initiale du prénom). */
function formatStudentDisplayName(
  e: { prenom: string; nom: string },
  compact: boolean,
): string {
  if (!compact) return `${e.prenom} ${e.nom}`.trim()
  const nomShort = e.nom.slice(0, 5)
  const prenomInitial = e.prenom ? e.prenom.charAt(0).toUpperCase() + '.' : ''
  return `${nomShort} ${prenomInitial}`.trim()
}

interface StudentsPanelProps {
  selectedEleveId: number | null
  onSelectEleve: (id: number | null) => void
}

function StudentsPanel({ selectedEleveId, onSelectEleve }: StudentsPanelProps) {
  const { eleves, elevesSansGroupe, classes, moveEleveToGroupe, ui, gristDebugInfo } = useAppState()
  const [selectedClass, setSelectedClass] = useState<string>('')
  const filteredSansGroupe = useMemo(
    () =>
      selectedClass
        ? elevesSansGroupe.filter((e) => e.classe === selectedClass)
        : elevesSansGroupe,
    [elevesSansGroupe, selectedClass],
  )
  const cinqPremiers = eleves.slice(0, 5)
  const handleUnassignDrop = async (evt: React.DragEvent) => {
    if (ui.readOnly) return
    const data = evt.dataTransfer.getData('text/plain')
    if (!data.startsWith('student:')) return
    const id = Number(data.split(':')[1])
    if (!Number.isNaN(id)) {
      await moveEleveToGroupe(id, null)
    }
  }
  return (
    <div className="panel students-panel">
      <div className="panel-header">
        <h2>Élèves non groupés</h2>
        <div className="panel-subtitle">{filteredSansGroupe.length} élèves</div>
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
        <select
          className="input"
          value={selectedClass}
          onChange={(evt) => setSelectedClass(evt.target.value)}
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div
        className="students-list students-list-dropzone"
        onDragOver={(evt) => {
          if (ui.readOnly) return
          evt.preventDefault()
          evt.currentTarget.classList.add('dropzone-active')
        }}
        onDragLeave={(evt) => {
          if (!evt.currentTarget.contains(evt.relatedTarget as Node)) {
            evt.currentTarget.classList.remove('dropzone-active')
          }
        }}
        onDrop={(evt) => {
          evt.currentTarget.classList.remove('dropzone-active')
          handleUnassignDrop(evt)
        }}
      >
        {filteredSansGroupe.map((e) => (
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
        {filteredSansGroupe.length === 0 && (
          <div className="empty-state">
            {selectedClass ? `Aucun élève non groupé dans la classe "${selectedClass}".` : 'Tous les élèves sont dans un groupe.'}
          </div>
        )}
      </div>
    </div>
  )
}

interface GroupsCanvasProps {
  selectedEleveId: number | null
  onEleveAssigned: () => void
  mode: 'eleves-groupes' | 'groupes-chambres'
}

function GroupsCanvas({ selectedEleveId, onEleveAssigned, mode }: GroupsCanvasProps) {
  const { groupesAvecEleves, moveEleveToGroupe, createGroupe, removeGroupe, ui } = useAppState()
  const handleDropOnNewGroup = async (eleveId: number) => {
    const newId = await createGroupe()
    await moveEleveToGroupe(eleveId, newId)
    onEleveAssigned()
  }
  return (
    <div className="panel canvas-panel">
      <div className="panel-header">
        <h2>{mode === 'eleves-groupes' ? 'Groupes' : 'Groupes (glissez vers les chambres)'}</h2>
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
              evt.dataTransfer.setData('text/plain', `group:${g.id}`)
            }}
          >
            <div className="group-header">
              <span className="group-title">Groupe {g.numGroupe}</span>
              <span className="group-count">{g.eleves.length} él.</span>
              {!ui.readOnly && (
                <button
                  type="button"
                  className="group-delete-btn"
                  title="Supprimer le groupe"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!window.confirm(`Supprimer le groupe ${g.numGroupe} ? Les élèves seront retirés du groupe.`)) return
                    await removeGroupe(g.id, g.eleves.map((e) => e.id))
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
            <div className="group-body">
              {g.eleves.map((e) => (
                <span
                  key={e.id}
                  className="group-student-pill"
                  draggable={!ui.readOnly}
                  onDragStart={(evt) => {
                    evt.stopPropagation()
                    evt.dataTransfer.setData('text/plain', `student:${e.id}`)
                  }}
                >
                  {formatStudentDisplayName(e, ui.compactMode)}
                  {!ui.readOnly && (
                    <button
                      type="button"
                      className="group-pill-remove"
                      title="Retirer du groupe"
                      onClick={async (evt) => {
                        evt.stopPropagation()
                        await moveEleveToGroupe(e.id, null)
                        onEleveAssigned()
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {g.eleves.length === 0 && (
                <span className="group-empty">Déposez des élèves ici</span>
              )}
            </div>
          </div>
        ))}
        {mode === 'eleves-groupes' && (
          <div
            className="group-card group-card-new"
            onDragOver={(evt) => {
              if (ui.readOnly) return
              evt.preventDefault()
            }}
            onDrop={async (evt) => {
              if (ui.readOnly) return
              const data = evt.dataTransfer.getData('text/plain')
              if (data.startsWith('student:')) {
                const id = Number(data.split(':')[1])
                if (!Number.isNaN(id)) await handleDropOnNewGroup(id)
              }
            }}
            onDoubleClick={async () => {
              if (ui.readOnly) return
              if (selectedEleveId != null) await handleDropOnNewGroup(selectedEleveId)
            }}
          >
            <div className="group-header">
              <span className="group-title">Nouveau groupe</span>
            </div>
            <div className="group-body">
              <span className="group-empty">Déposez un élève ici pour créer un groupe</span>
            </div>
          </div>
        )}
        {groupesAvecEleves.length === 0 && mode !== 'eleves-groupes' && (
          <div className="empty-state">
            Aucun groupe. Passez par l’onglet « Élèves → Groupes » pour en créer.
          </div>
        )}
      </div>
    </div>
  )
}

function RoomsPanel() {
  const { chambresAvecStats, groupesAvecEleves, moveGroupeToChambre, ui } = useAppState()
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
          const groupesDansChambre = groupesAvecEleves.filter((g) => g.chambreId === c.id)
          const elevesDansChambre = groupesDansChambre.flatMap((g) => g.eleves)
          return (
            <div
              key={c.id}
              className={`room-card ${full ? 'room-full' : 'room-available'} ${
                ui.hasGroupRoomLink ? '' : 'room-disabled'
              }`}
              draggable={false}
              onDragOver={(evt) => {
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
              {elevesDansChambre.length > 0 && (
                <div className="room-students">
                  <div className="room-students-label">Élèves affectés</div>
                  <ul className="room-students-list">
                    {elevesDansChambre.map((e) => (
                      <li key={e.id} className="room-student-item">
                        {formatStudentDisplayName(e, ui.compactMode)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {elevesDansChambre.length === 0 && (
                <div className="room-students room-students-empty">
                  Aucun élève affecté
                </div>
              )}
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

export default App
