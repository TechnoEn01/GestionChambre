import './App.css'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAppState } from './state/AppStateContext'

type AppPage = 'eleves-groupes' | 'groupes-chambres'

function App() {
  const { ui, schemaOk, lockEleve, unlockEleve, selectedSejour, setSelectedSejour } = useAppState()
  const [selectedEleveId, setSelectedEleveId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState<AppPage>('eleves-groupes')
  const [draggedStudentId, setDraggedStudentId] = useState<number | null>(null)
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null)

  const handleStudentDragStart = (id: number) => {
    setDraggedStudentId(id)
    lockEleve(id)
  }
  const handleStudentDragEnd = () => {
    if (draggedStudentId != null) unlockEleve(draggedStudentId)
    setDraggedStudentId(null)
  }

  const refStudentsList = useRef<HTMLDivElement>(null)
  const refGroupsCanvas = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)
  const handleStudentsListScroll = useCallback((scrollTop: number) => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (refGroupsCanvas.current) refGroupsCanvas.current.scrollTop = scrollTop
    requestAnimationFrame(() => { isSyncingScroll.current = false })
  }, [])
  const handleGroupsCanvasScroll = useCallback((scrollTop: number) => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (refStudentsList.current) refStudentsList.current.scrollTop = scrollTop
    requestAnimationFrame(() => { isSyncingScroll.current = false })
  }, [])

  return (
    <div className={`app-root app-theme-${ui.theme} ${ui.compactMode ? 'app-compact' : ''}`}>
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">
            {currentPage === 'eleves-groupes'
              ? 'Affecter les élèves aux groupes'
              : 'Composition Chambre'}
          </h1>
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
        <div className="app-nav-sejour">
          <span className="app-nav-sejour-label">Séjour :</span>
          <button
            type="button"
            className={`app-nav-tab app-nav-sejour-tab ${selectedSejour === 1 ? 'app-nav-tab-active' : ''}`}
            onClick={() => setSelectedSejour(1)}
          >
            Séjour 1
          </button>
          <button
            type="button"
            className={`app-nav-tab app-nav-sejour-tab ${selectedSejour === 2 ? 'app-nav-tab-active' : ''}`}
            onClick={() => setSelectedSejour(2)}
          >
            Séjour 2
          </button>
        </div>
        <div className="app-nav-pages">
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
        </div>
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
        <main className="app-main app-main-eleves-groupes">
          <section className="sidebar">
            <StudentsPanel
              selectedEleveId={selectedEleveId}
              onSelectEleve={(id) => setSelectedEleveId(id)}
              draggedStudentId={draggedStudentId}
              onStudentDragStart={handleStudentDragStart}
              onStudentDragEnd={handleStudentDragEnd}
              studentsListRef={refStudentsList}
              onStudentsListScroll={handleStudentsListScroll}
            />
          </section>
          <section className="canvas-section">
            {schemaOk ? (
              <GroupsCanvas
                selectedEleveId={selectedEleveId}
                onEleveAssigned={() => setSelectedEleveId(null)}
                mode="eleves-groupes"
                draggedStudentId={draggedStudentId}
                onStudentDragStart={handleStudentDragStart}
                onStudentDragEnd={handleStudentDragEnd}
                groupsCanvasRef={refGroupsCanvas}
                onGroupsCanvasScroll={handleGroupsCanvasScroll}
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
        </main>
      )}
      {currentPage === 'groupes-chambres' && (
        <main className="app-main app-main-groupes-chambres">
          <section className="sidebar groupes-sidebar">
            {schemaOk ? (
              <GroupsCanvas
                selectedEleveId={null}
                onEleveAssigned={() => {}}
                mode="groupes-chambres"
                draggedGroupId={draggedGroupId}
                onGroupDragStart={(id) => setDraggedGroupId(id)}
                onGroupDragEnd={() => setDraggedGroupId(null)}
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

/** Affiche le nom d’un élève : NOM  Prénom (ou format court en mode compact). */
function formatStudentDisplayName(
  e: { prenom: string; nom: string },
  compact: boolean,
): string {
  const sep = '\u00A0\u00A0 ' // espacement entre nom et prénom
  if (!compact) return `${e.nom}${sep}${e.prenom}`.trim()
  const nomShort = e.nom.slice(0, 5)
  const prenomInitial = e.prenom ? e.prenom.charAt(0).toUpperCase() + '.' : ''
  return `${nomShort}${sep}${prenomInitial}`.trim()
}

interface StudentsPanelProps {
  selectedEleveId: number | null
  onSelectEleve: (id: number | null) => void
  draggedStudentId: number | null
  onStudentDragStart: (id: number) => void
  onStudentDragEnd: () => void
  studentsListRef?: React.RefObject<HTMLDivElement | null>
  onStudentsListScroll?: (scrollTop: number) => void
}

function StudentsPanel({ selectedEleveId, onSelectEleve, draggedStudentId, onStudentDragStart, onStudentDragEnd, studentsListRef, onStudentsListScroll }: StudentsPanelProps) {
  const { eleves, elevesSansGroupe, classes, moveEleveToGroupe, ui, gristDebugInfo } = useAppState()
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const filteredSansGroupe = useMemo(() => {
    let list = elevesSansGroupe
    if (selectedClasses.length > 0) {
      list = list.filter((e) => selectedClasses.includes(e.classe))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.nom.toLowerCase().includes(q) ||
          e.prenom.toLowerCase().includes(q) ||
          e.classe.toLowerCase().includes(q) ||
          `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
          `${e.nom} ${e.prenom}`.toLowerCase().includes(q),
      )
    }
    return list
  }, [elevesSansGroupe, selectedClasses, searchQuery])
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
  const toggleClass = (c: string) => {
    setSelectedClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
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
                  {e.nom}  {e.prenom} · {e.classe} · Groupe id: {e.groupeId ?? '—'}
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Rechercher par nom, prénom ou classe"
        />
        <div className="students-class-filter">
          <span className="students-class-filter-label">Classes à afficher</span>
          <label className="students-class-checkbox">
            <input
              type="checkbox"
              checked={selectedClasses.length === 0}
              onChange={() => setSelectedClasses([])}
            />
            Toutes les classes
          </label>
          <div className="students-class-list">
            {classes.map((c) => (
              <label key={c} className="students-class-checkbox">
                <input
                  type="checkbox"
                  checked={selectedClasses.includes(c)}
                  onChange={() => toggleClass(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={studentsListRef}
        className="students-list students-list-dropzone"
        onScroll={onStudentsListScroll ? (evt) => onStudentsListScroll(evt.currentTarget.scrollTop) : undefined}
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
            className={`student-card ${selectedEleveId === e.id ? 'student-card-selected' : ''} ${draggedStudentId === e.id ? 'student-card-dragging' : ''}`}
            draggable={!ui.readOnly}
            onClick={() => onSelectEleve(selectedEleveId === e.id ? null : e.id)}
            onDragStart={(evt) => {
              if (ui.readOnly) return
              onStudentDragStart(e.id)
              evt.dataTransfer.setData('text/plain', `student:${e.id}`)
            }}
            onDragEnd={() => onStudentDragEnd()}
          >
            <div className="student-name">
              <span className="student-nom">{e.nom}</span>
              <span className="student-prenom">{e.prenom}</span>
            </div>
            <div className="student-meta">{e.classe}</div>
            {e.verrou && (
              <div className="student-lock" title={`Verrouillé par ${e.verrou}`}>
                Verrouillé par {e.verrou}
              </div>
            )}
          </div>
        ))}
        {filteredSansGroupe.length === 0 && (
          <div className="empty-state">
            {searchQuery.trim()
              ? 'Aucun élève ne correspond à la recherche.'
              : selectedClasses.length > 0
                ? 'Aucun élève non groupé dans les classes sélectionnées.'
                : 'Tous les élèves sont dans un groupe.'}
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
  draggedStudentId?: number | null
  onStudentDragStart?: (id: number) => void
  onStudentDragEnd?: () => void
  draggedGroupId?: number | null
  onGroupDragStart?: (id: number) => void
  onGroupDragEnd?: () => void
  groupsCanvasRef?: React.RefObject<HTMLDivElement | null>
  onGroupsCanvasScroll?: (scrollTop: number) => void
}

function GroupsCanvas({ selectedEleveId, onEleveAssigned, mode, draggedStudentId = null, onStudentDragStart, onStudentDragEnd, draggedGroupId = null, onGroupDragStart, onGroupDragEnd, groupsCanvasRef, onGroupsCanvasScroll }: GroupsCanvasProps) {
  const { groupesAvecEleves, moveEleveToGroupe, createGroupe, removeGroupe, updateGroupeCouleur, ui } = useAppState()
  const [dragOverGroupId, setDragOverGroupId] = useState<number | null>(null)
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
      <div
        ref={groupsCanvasRef}
        className="canvas"
        onScroll={onGroupsCanvasScroll ? (evt) => onGroupsCanvasScroll(evt.currentTarget.scrollTop) : undefined}
      >
        {groupesAvecEleves.map((g) => {
          const borderColor = g.couleur && /^#?[0-9A-Fa-f]{6}$/.test(g.couleur.replace('#', '')) ? (g.couleur.startsWith('#') ? g.couleur : `#${g.couleur}`) : '#4f46e5'
          const bgColor = `${borderColor}18`
          return (
          <div
            key={g.id}
            className={`group-card ${dragOverGroupId === g.id && draggedStudentId != null ? 'group-card-drag-over' : ''} ${draggedGroupId === g.id ? 'group-card-dragging' : ''}`}
            style={{ borderColor, backgroundColor: bgColor }}
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
              if (mode === 'eleves-groupes') setDragOverGroupId(g.id)
            }}
            onDragLeave={(evt) => {
              if (!evt.currentTarget.contains(evt.relatedTarget as Node)) setDragOverGroupId(null)
            }}
            onDrop={async (evt) => {
              if (mode === 'eleves-groupes') setDragOverGroupId(null)
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
              if (mode === 'groupes-chambres') onGroupDragStart?.(g.id)
            }}
            onDragEnd={() => {
              if (mode === 'groupes-chambres') onGroupDragEnd?.()
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
                  aria-label="Supprimer le groupe"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!window.confirm(`Supprimer le groupe ${g.numGroupe} ? Les élèves seront retirés du groupe.`)) return
                    await removeGroupe(g.id, g.eleves.map((e) => e.id))
                  }}
                >
                  <svg className="group-delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>
            <div className="group-body">
              {g.eleves.map((e) => (
                <span
                  key={e.id}
                  className={`group-student-pill ${draggedStudentId === e.id ? 'group-pill-dragging' : ''}`}
                  draggable={!ui.readOnly}
                  onDragStart={(evt) => {
                    evt.stopPropagation()
                    onStudentDragStart?.(e.id)
                    evt.dataTransfer.setData('text/plain', `student:${e.id}`)
                  }}
                  onDragEnd={() => onStudentDragEnd?.()}
                >
                  {formatStudentDisplayName(e, ui.compactMode)}
                  {e.verrou && (
                    <span className="group-pill-lock" title={`Verrouillé par ${e.verrou}`}>
                      🔒
                    </span>
                  )}
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
            {!ui.readOnly && (
              <div className="group-footer">
                <input
                  type="color"
                  className="group-color-picker"
                  value={borderColor}
                  onChange={(e) => {
                    e.stopPropagation()
                    updateGroupeCouleur(g.id, e.target.value)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title="Changer la couleur du groupe"
                  aria-label="Changer la couleur du groupe"
                />
              </div>
            )}
          </div>
          );
        })}
        {mode === 'eleves-groupes' && (
          <div
            className="group-card group-card-new"
            onDragOver={(evt) => {
              if (ui.readOnly) return
              evt.preventDefault()
            }}
            onDrop={async (evt) => {
              if (ui.readOnly) return
              setDragOverGroupId(null)
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
  const { chambresAvecStats, groupesAvecEleves, moveGroupeToChambre, ui, setRoomsPerLine } = useAppState()
  const [dragOverRoomId, setDragOverRoomId] = useState<number | null>(null)
  const chambresOrdonnees = useMemo(
    () =>
      [...chambresAvecStats].sort((a, b) => {
        const aFull = a.capaciteRestante === 0
        const bFull = b.capaciteRestante === 0
        return (aFull ? 1 : 0) - (bFull ? 1 : 0)
      }),
    [chambresAvecStats],
  )
  const roomsPerLine = ui.compactMode ? 1 : (ui.roomsPerLine ?? 1)
  return (
    <div className="panel rooms-panel">
      <div className="panel-header">
        <h2>Chambres</h2>
        <div className="panel-header-actions">
          {!ui.hasGroupRoomLink && (
            <div className="panel-subtitle">
              Colonne <code>Chambre</code> absente dans la table <code>Groupe</code> : dépôt de
              groupes désactivé.
            </div>
          )}
          {!ui.compactMode && (
            <label className="rooms-per-line-control">
              <span className="rooms-per-line-label">Chambres par ligne</span>
              <select
                className="input rooms-per-line-select"
                value={ui.roomsPerLine}
                onChange={(e) => setRoomsPerLine(Number(e.target.value))}
                title="Nombre de chambres affichées par ligne"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div
        className="rooms-list"
        style={{ ['--rooms-per-line' as string]: roomsPerLine }}
      >
        {chambresOrdonnees.map((c) => {
          const full = c.capaciteRestante === 0
          const groupesDansChambre = groupesAvecEleves.filter((g) => g.chambreId === c.id)
          const elevesDansChambre = groupesDansChambre.flatMap((g) => g.eleves)
          return (
            <div
              key={c.id}
              className={`room-card ${full ? 'room-full' : 'room-available'} ${
                ui.hasGroupRoomLink ? '' : 'room-disabled'
              } ${dragOverRoomId === c.id ? 'room-card-drag-over' : ''}`}
              draggable={false}
              onDragOver={(evt) => {
                if (!ui.hasGroupRoomLink || ui.readOnly) return
                evt.preventDefault()
                setDragOverRoomId(c.id)
              }}
              onDragLeave={(evt) => {
                if (!evt.currentTarget.contains(evt.relatedTarget as Node)) setDragOverRoomId(null)
              }}
              onDrop={async (evt) => {
                setDragOverRoomId(null)
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
                <span className="room-capacity-badge">
                  {c.totalEleves} / {c.capacite}
                </span>
              </div>
              <div className="room-capacity-bar-wrap" title={`${c.capaciteRestante} place(s) restante(s)`}>
                <div
                  className="room-capacity-bar"
                  role="progressbar"
                  aria-valuenow={c.totalEleves}
                  aria-valuemin={0}
                  aria-valuemax={c.capacite}
                  aria-label={`${c.capaciteRestante} places restantes sur ${c.capacite}`}
                >
                  <div
                    className={`room-capacity-bar-fill ${full ? 'room-capacity-bar-full' : ''}`}
                    style={{ width: `${c.capacite > 0 ? (c.totalEleves / c.capacite) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="room-meta">
                {full ? 'Complet' : `${c.capaciteRestante} place${c.capaciteRestante > 1 ? 's' : ''} restante${c.capaciteRestante > 1 ? 's' : ''}`}
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
        {chambresOrdonnees.length === 0 && (
          <div className="empty-state">
            Aucune chambre trouvée. Vérifiez la table <code>Chambre</code> dans Grist.
          </div>
        )}
      </div>
    </div>
  )
}

export default App
