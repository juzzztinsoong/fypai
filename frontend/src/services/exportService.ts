import { api, getErrorMessage } from './api'

export type SessionExportFormat = 'json' | 'csv' | 'timeline-json' | 'metrics-csv'

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function exportSession(teamId: string, format: SessionExportFormat): Promise<void> {
  try {
    if (format === 'csv' || format === 'metrics-csv') {
      const response = await api.get<string>(`/export/session/${teamId}`, {
        params: { format },
        responseType: 'text' as const,
      })
      const fileName = format === 'metrics-csv' ? `session-${teamId}-metrics.csv` : `session-${teamId}.csv`
      downloadBlob(response.data, fileName, 'text/csv;charset=utf-8')
      return
    }

    const response = await api.get(`/export/session/${teamId}`, {
      params: { format },
    })
    const fileName = format === 'timeline-json' ? `session-${teamId}-timeline.json` : `session-${teamId}.json`
    downloadBlob(JSON.stringify(response.data, null, 2), fileName, 'application/json;charset=utf-8')
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[ExportService] Failed to export session:', message)
    throw new Error(message)
  }
}

export default {
  exportSession,
}
