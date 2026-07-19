import instance, { doAction, type DoResult } from './request'

export interface DownloadTask {
  id: string
  name: string
  title: string
  image: string
  speed: string
  state: string
  progress: number
}

interface DownloadingResult {
  code: number
  msg?: string
  result: DownloadTask[]
}

interface PtResult {
  retcode: number
  retmsg?: string
  id: string | string[]
}

export function getDownloading(): Promise<DownloadingResult> {
  return doAction<DownloadingResult>('get_downloading', {})
}

export function ptStart(id: string | string[]): Promise<PtResult> {
  return doAction<PtResult>('pt_start', { id })
}

export function ptStop(id: string | string[]): Promise<PtResult> {
  return doAction<PtResult>('pt_stop', { id })
}

export function ptRemove(id: string | string[]): Promise<PtResult> {
  return doAction<PtResult>('pt_remove', { id })
}

export interface DownloadSettingOption {
  id: number | string
  name: string
}

export interface DownloadDirResult {
  code: number
  paths: string[]
}

export interface DownloadSettingResult {
  code: number
  data: DownloadSettingOption[]
}

export function getDownloadSettings(): Promise<DownloadSettingResult> {
  return doAction<DownloadSettingResult>('get_download_setting', {})
}

export function getDownloadDirs(sid: string | number = '', site = ''): Promise<DownloadDirResult> {
  return doAction<DownloadDirResult>('get_download_dirs', { sid, site })
}

export interface DownloadTorrentParams {
  files: { upload: { filename: string } }[]
  magnets: string[]
  dl_dir: string
  dl_setting: string | number
}

export function downloadTorrent(params: DownloadTorrentParams): Promise<{ code: number; msg?: string }> {
  return doAction<{ code: number; msg?: string }>('download_torrent', params)
}

export async function uploadTorrentFile(file: File): Promise<{ code?: number; filepath?: string; msg?: string }> {
  const form = new FormData()
  form.append('file', file, file.name)
  const resp = await instance.post<DoResult & { filepath?: string }>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return resp.data
}

export function downloadSearchItem(id: string | number, dir: string, setting: string | number): Promise<{ retcode: number; retmsg?: string }> {
  return doAction<{ retcode: number; retmsg?: string }>('download', { id, dir, setting })
}

export interface TorrentRemoveTask {
  id: string
  name: string
  downloader: string
  action: number
  interval: number
  enabled: boolean
  samedata: boolean
  onlynastool: boolean
  config: {
    ratio?: number
    seeding_time?: number
    upload_avs?: number
    size?: [number, number]
    tags?: string[]
    savepath_key?: string
    tracker_key?: string
    qb_category?: string[]
    qb_state?: string[]
    tr_state?: string[]
    tr_error_key?: string
  }
}

export interface TorrentRemoveTaskListResult {
  code: number
  result?: Record<string, TorrentRemoveTask>
}

export interface TorrentRemoveTaskDetailResult {
  code: number
  detail?: TorrentRemoveTask
}

export interface RemoveTorrentItem {
  name: string
  site: string
  size: number
}

export interface RemoveTorrentsResult {
  code: number
  data?: RemoveTorrentItem[]
  msg?: string
}

export function getTorrentRemoveTasks(): Promise<TorrentRemoveTaskListResult> {
  return doAction<TorrentRemoveTaskListResult>('get_torrent_remove_tasks', {})
}

export function getTorrentRemoveTask(tid: string): Promise<TorrentRemoveTaskDetailResult> {
  return doAction<TorrentRemoveTaskDetailResult>('get_torrent_remove_task', { tid })
}

export function updateTorrentRemoveTask(params: Record<string, unknown>): Promise<{ code: number; msg?: string }> {
  return doAction<{ code: number; msg?: string }>('update_torrent_remove_task', params)
}

export function deleteTorrentRemoveTask(tid: string): Promise<{ code: number }> {
  return doAction<{ code: number }>('delete_torrent_remove_task', { tid })
}

export function getRemoveTorrents(tid: string): Promise<RemoveTorrentsResult> {
  return doAction<RemoveTorrentsResult>('get_remove_torrents', { tid })
}

export function autoRemoveTorrents(tid: string): Promise<{ code: number; msg?: string }> {
  return doAction<{ code: number; msg?: string }>('auto_remove_torrents', { tid })
}
