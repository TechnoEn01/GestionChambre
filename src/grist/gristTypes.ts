// Types minimaux pour travailler avec l'API Grist dans le contexte du widget.

export interface GristRecord {
  id: number
  [key: string]: any
}

export interface GristTableData {
  id: number[]
  [col: string]: any[]
}

export interface GristDocData {
  [tableId: string]: GristTableData
}

export interface GristSelection {
  tableId: string | null
  rowId: number | null
}

export interface GristUser {
  name?: string
  email?: string
}

export interface GristDocInfo {
  user: GristUser | null
}

export interface GristDocApi {
  fetchTable(tableId: string): Promise<GristTableData>
  applyUpdate(tableId: string, rowId: number, fields: Record<string, any>): Promise<void>
  addRecords(tableId: string, records: Record<string, any>[]): Promise<void>
}

export interface Grist {
  on(event: 'data', cb: (data: GristDocData) => void): void
  on(event: 'selection', cb: (sel: GristSelection) => void): void
  on(event: 'docInfo', cb: (info: GristDocInfo) => void): void
  on(event: 'error', cb: (err: any) => void): void
  ready(): void
  // Accès direct aux données complètes (full access).
  docApi: GristDocApi
  // Paramètres de configuration du widget (mapping, options, etc.).
  onSettings(cb: (settings: any) => void): void
}

declare global {
  interface Window {
    grist?: Grist
  }
}

