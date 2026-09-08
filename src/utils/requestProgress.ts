import { reactive } from 'vue'
import type { AxiosProgressEvent } from 'axios'

type ProgressPhase = 'upload' | 'download'

interface PhaseProgress {
  seen: boolean
  loaded: number
  total: number | null
}

interface TrackedRequest {
  upload: PhaseProgress
  download: PhaseProgress
}

export const requestProgressState = reactive({
  visible: false,
  indeterminate: true,
  finishing: false,
  percent: 0
})

const requests = new Map<number, TrackedRequest>()
let nextRequestId = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null

function createPhase(): PhaseProgress {
  return { seen: false, loaded: 0, total: null }
}

function createRequest(): TrackedRequest {
  return { upload: createPhase(), download: createPhase() }
}

function recalculate(): void {
  if (requests.size === 0) return

  const phases = [...requests.values()].flatMap((request) => [
    request.upload,
    request.download
  ])
  const hasUnknownProgress = [...requests.values()].some((request) => {
    // A request is not measurable until a download progress event arrives.
    if (!request.download.seen) return true
    return [request.upload, request.download].some(
      (phase) => phase.seen && phase.total === null
    )
  })

  const measurablePhases = phases.filter(
    (phase) => phase.seen && phase.total !== null && phase.total > 0
  )
  const total = measurablePhases.reduce((sum, phase) => sum + (phase.total ?? 0), 0)
  const loaded = measurablePhases.reduce((sum, phase) => sum + phase.loaded, 0)

  requestProgressState.indeterminate = hasUnknownProgress
  requestProgressState.percent = total > 0
    ? Math.min(100, Math.max(0, (loaded / total) * 100))
    : 0
}

export function startRequest(): number {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  const id = ++nextRequestId
  requests.set(id, createRequest())
  requestProgressState.visible = true
  requestProgressState.finishing = false
  requestProgressState.indeterminate = true
  requestProgressState.percent = 0
  return id
}

export function updateRequestProgress(
  id: number,
  phase: ProgressPhase,
  event: AxiosProgressEvent
): void {
  const request = requests.get(id)
  if (!request) return

  const current = request[phase]
  current.seen = true
  current.loaded = Math.max(current.loaded, event.loaded)
  if (event.total && event.total > 0) {
    current.total = Math.max(current.total ?? 0, event.total)
  }
  recalculate()
}

export function finishRequest(id: number): void {
  if (!requests.delete(id)) return

  if (requests.size > 0) {
    recalculate()
    return
  }

  requestProgressState.percent = 100
  requestProgressState.indeterminate = false
  requestProgressState.finishing = true

  hideTimer = setTimeout(() => {
    requestProgressState.visible = false
    requestProgressState.finishing = false
    requestProgressState.percent = 0
    requestProgressState.indeterminate = true
    hideTimer = null
  }, 220)
}
