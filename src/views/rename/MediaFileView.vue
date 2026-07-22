<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'
import { nameTest, refreshProcess, type NameTestData, type RefreshProcessResult } from '@/api/system'
import { RMT_MODES } from '@/utils/rmtMode'

interface FileItem {
  path: string
  name: string
  ext: string
  size: string
  type?: string
  is_dir?: boolean
}

interface TmdbSearchItem {
  tmdb_id: string
  title: string
  year: string
  image: string
  overview: string
  link: string
}

interface HardlinkFile {
  file: string
  filename: string
  filepath: string
}

type NameTestResult = NameTestData | { name: string }

const techChipOrder = ['restype', 'pix', 'video_codec', 'audio_codec', 'team'] as const
type TechChipKey = (typeof techChipOrder)[number]

const chipLabels: Record<TechChipKey, string> = {
  restype: '质量', pix: '分辨率', video_codec: '视频编码', audio_codec: '音频编码', team: '制作组'
}

const clickableChips = new Set(['title', 'tmdbid', 'name', 'season_episode'])

const modal = useModalStore()
const route = useRoute()
const loading = ref(false)
const currentDir = ref('')
const pathInput = ref('')
const pathCrumbs = ref<{ label: string; path: string }[]>([])
const files = ref<FileItem[]>([])
const showTree = ref(false)

const nameTestResults = reactive<Record<string, NameTestResult>>({})
const nameTestLoading = reactive<Record<string, boolean>>({})

// Action sheet for rename/delete/hardlink
const showMoreActions = ref(false)
const activeFile = ref<FileItem | null>(null)
const moreActions = [
  { name: '重命名', icon: 'edit' },
  { name: '查找硬链接', icon: 'link-o' },
  { name: '删除', icon: 'delete-o', color: '#ee0a24' },
]

// Transfer dialog
const showTransfer = ref(false)
const isTransferDir = ref(false)
const transferForm = ref({
  outpath: '',
  syncmod: 'copy',
  type: 'MOV',
  tmdb: '',
  season: '',
  min_filesize: '',
  episode_format: '',
  episode_details: '',
  episode_offset: '',
})
const transferLoading = ref(false)

const progressVisible = ref(false)
const progressValue = ref(0)
const progressText = ref('请稍候...')
const progressTitle = ref('')
let progressTimer: ReturnType<typeof setTimeout> | null = null
let pollingActive = false

// Hardlink state
const hardlinkVisible = ref(false)
const hardlinkLoading = ref(false)
const hardlinkDir = ref('')
const hardlinkResults = ref<Record<string, HardlinkFile[]>>({})
const hardlinkSearchDirVisible = ref(false)
const hardlinkPendingFiles = ref<string[]>([])
const hardlinkSelected = ref<Set<string>>(new Set())

const allHardlinkFiles = computed(() => {
  const files: string[] = []
  for (const list of Object.values(hardlinkResults.value)) {
    for (const h of list) {
      files.push(h.file)
    }
  }
  return files
})

const allHardlinkSelected = computed(() => {
  return allHardlinkFiles.value.length > 0 && allHardlinkFiles.value.every(f => hardlinkSelected.value.has(f))
})

function startProgressPolling(type: string) {
  stopProgressPolling()
  pollingActive = true
  async function poll() {
    try {
      const res = await refreshProcess(type)
      if (res.code === 0 && res.value <= 100) {
        progressValue.value = res.value
        progressText.value = res.text
      }
    } catch {}
    if (pollingActive) {
      progressTimer = setTimeout(poll, 200)
    }
  }
  poll()
}

function stopProgressPolling() {
  pollingActive = false
  if (progressTimer) {
    clearTimeout(progressTimer)
    progressTimer = null
  }
}

const defaultSyncmod = ref('copy')
const showSyncmodPicker = ref(false)
const SYNC_MODS = RMT_MODES.map(m => ({ text: m.label, value: m.value as string }))

function openSyncmodPicker() {
  showTransfer.value = false
  nextTick(() => {
    showSyncmodPicker.value = true
  })
}

const TYPE_OPTIONS = [
  { text: '电影', value: 'MOV' },
  { text: '电视剧', value: 'TV' },
  { text: '动漫', value: 'ANIME' },
]
const showTypePicker = ref(false)

function openTypePicker() {
  showTransfer.value = false
  nextTick(() => {
    showTypePicker.value = true
  })
}

const showTmdbSearch = ref(false)
const tmdbSearchKeyword = ref('')
const tmdbSearchResults = ref<TmdbSearchItem[]>([])
const tmdbSearchLoading = ref(false)

const showRename = ref(false)
const renameNewName = ref('')

// Tree popup
const treePath = ref('/')
const treeItems = ref<FileItem[]>([])
const treeLoading = ref(false)

function getParentDir(p: string) {
  const idx = p.lastIndexOf('/')
  if (idx <= 0) return '/'
  return p.slice(0, idx)
}

function baseName(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx >= 0 ? p.slice(idx + 1) : p
}

onMounted(async () => {
  const queryPath = route.query.path as string
  if (queryPath) {
    currentDir.value = queryPath
    loadFiles(queryPath)
    return
  }
  try {
    const res = await doAction<{ code: number; config?: Record<string, unknown> }>('get_config', {})
    if (res.code === 0) {
      const cfg = res.config
      const mode = (cfg?.pt as Record<string, unknown>)?.['rmt_mode'] as string | undefined
      if (mode) { defaultSyncmod.value = mode; transferForm.value.syncmod = mode }
      const dirs = cfg?.downloaddir as Array<{ save_path?: string }> | undefined
      if (dirs && dirs.length > 0 && dirs[0].save_path) {
        const p = getParentDir(dirs[0].save_path)
        currentDir.value = p
        loadFiles(p)
        return
      }
    }
  } catch { /* ignore */ }
  currentDir.value = '/'
  loadFiles('/')
})

async function loadFiles(dir: string) {
  loading.value = true
  currentDir.value = dir
  try {
    const res = await doAction<{ code: number; data?: FileItem[] }>('get_sub_path', { dir, filter: 'ALL' })
    if (res.code === 0) {
      const items = (res.data || []).map((i: any) => ({
        ...i,
        is_dir: !!(i.is_dir || i.type === 'dir' || i.type === 'directory' || (i.ext === '' && !i.type))
      }))
      const dirs = items.filter(i => i.is_dir)
      const fil = items.filter(i => !i.is_dir)
      files.value = [...dirs, ...fil]
    }
  } catch { showToast('加载失败') }
  finally { loading.value = false }
  updateCrumbs()
}

function updateCrumbs() {
  const parts = currentDir.value.split('/').filter(Boolean)
  let cur = ''
  pathCrumbs.value = [{ label: '根目录', path: '/' }]
  parts.forEach(p => {
    cur += '/' + p
    pathCrumbs.value.push({ label: p, path: cur })
  })
}

function goPath(path: string) {
  loadFiles(path)
  showTree.value = false
}

function goParent() {
  const idx = currentDir.value.lastIndexOf('/')
  if (idx <= 0) return loadFiles('/')
  loadFiles(currentDir.value.slice(0, idx) || '/')
}

function goInput() {
  if (!pathInput.value) return
  loadFiles(pathInput.value)
  pathInput.value = ''
}

// ---- Identify ----
async function doNameTest(f: FileItem) {
  const key = f.path
  nameTestLoading[key] = true
  try {
    const res = await nameTest(f.name)
    if (res.code === 0 && res.data) {
      nameTestResults[key] = res.data
    } else {
      nameTestResults[key] = { name: '无法识别' }
    }
  } catch {
    nameTestResults[key] = { name: '识别失败' }
  } finally {
    nameTestLoading[key] = false
  }
}

function isNameTestResult(d: NameTestResult): d is NameTestData {
  return 'title' in d
}

const parsedResults = computed(() => {
  const out: Record<string, NameTestData> = {}
  for (const [k, v] of Object.entries(nameTestResults)) {
    if (isNameTestResult(v)) out[k] = v
  }
  return out
})

function hasTechInfo(d: NameTestData): boolean {
  return techChipOrder.some(k => !!d[k])
}

function mediaTypeLabel(t?: string): string {
  if (t === 'MOV') return '电影'
  if (t === 'TV') return '电视剧'
  if (t === 'ANIME') return '动漫'
  return t || ''
}

function mediaTypeColor(t?: string): string {
  if (t === '电影') return '#1989fa'
  if (t === '电视剧') return '#07c160'
  if (t === '动漫') return '#ff976a'
  return '#969799'
}

function handleChipClick(key: string, f: FileItem) {
  if (!clickableChips.has(key)) return
  const result = nameTestResults[f.path]
  if (!result || !isNameTestResult(result)) return
  if (key === 'title') {
    navigator.clipboard?.writeText(result.title).then(() => showToast('已复制标题')).catch(() => {})
  } else if (key === 'tmdbid') {
    const base = result.type === '电影' ? 'movie' : 'tv'
    const url = `https://www.themoviedb.org/${base}/${result.tmdbid}`
    window.open(url, '_blank')
  } else if (key === 'name') {
    const url = `https://www.themoviedb.org/search?query=${encodeURIComponent(result.name)}`
    window.open(url, '_blank')
  } else if (key === 'season_episode') {
    const se = result.season_episode?.match(/\d+/)
    if (result.tmdb_S_E_link) {
      window.open(result.tmdb_S_E_link, '_blank')
    } else if (se && result.tmdbid) {
      const url = `https://www.themoviedb.org/${result.type === 'TV' ? 'tv' : 'movie'}/${result.tmdbid}/season/${se[0]}`
      window.open(url, '_blank')
    }
  }
}

// ---- Tree ----
function openTree() {
  treePath.value = currentDir.value
  treeLoading.value = true
  showTree.value = true
  loadTreeLevel(currentDir.value)
}

async function loadTreeLevel(dir: string) {
  treeLoading.value = true
  try {
    const res = await doAction<{ code: number; data?: FileItem[] }>('get_sub_path', { dir, filter: 'ALL' })
    if (res.code === 0) {
      treeItems.value = (res.data || []).map((i: any) => ({
        ...i,
        is_dir: !!(i.is_dir || i.type === 'dir' || i.type === 'directory' || (i.ext === '' && !i.type))
      }))
    }
    else treeItems.value = []
  } catch { treeItems.value = [] }
  finally { treeLoading.value = false }
}

function treeGoUp() {
  const idx = treePath.value.lastIndexOf('/')
  if (idx <= 0) { treePath.value = '/'; loadTreeLevel('/'); return }
  treePath.value = treePath.value.slice(0, idx) || '/'
  loadTreeLevel(treePath.value)
}

function treeGoPath(dir: string) {
  treePath.value = dir
  loadTreeLevel(dir)
}

function onTreeSelect(item: FileItem) {
  showTree.value = false
  if (item.is_dir) {
    loadFiles(item.path)
  } else {
    loadFiles(treePath.value)
  }
}

// ---- Actions ----
function onFileClick(f: FileItem) {
  if (f.is_dir) {
    loadFiles(f.path)
  }
}

function openMoreActions(f: FileItem) {
  activeFile.value = f
  showMoreActions.value = true
}

function onMoreActionSelect(index: number) {
  const f = activeFile.value
  if (!f) return
  if (index === 0) doRename(f)
  else if (index === 1) openHardlink(f)
  else if (index === 2) doDelete(f)
}

async function doDelete(f: FileItem) {
  showMoreActions.value = false
  const ok = await modal.confirm(`确认删除「${f.name}」？`)
  if (!ok) return
  try {
    const res = await doAction<{ code: number; msg?: string }>('delete_files', { files: [f.path] })
    if (res.code === 0) { showToast('删除成功'); loadFiles(currentDir.value) }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

function doRename(f: FileItem) {
  activeFile.value = f
  renameNewName.value = f.name
  showMoreActions.value = false
  showRename.value = true
}

async function submitRename() {
  if (!activeFile.value || !renameNewName.value) return
  try {
    const res = await doAction<{ code: number; msg?: string }>('rename_file', { path: activeFile.value.path, name: renameNewName.value })
    if (res.code === 0) { showToast('重命名成功'); showRename.value = false; loadFiles(currentDir.value) }
    else showToast(res.msg || '重命名失败')
  } catch { showToast('重命名失败') }
}

// ---- Transfer ----
function resetTransferForm() {
  transferForm.value = {
    outpath: '', syncmod: defaultSyncmod.value, type: 'MOV', tmdb: '', season: '',
    min_filesize: '', episode_format: '', episode_details: '', episode_offset: ''
  }
}

function openTransferFile(f: FileItem) {
  activeFile.value = f
  isTransferDir.value = false
  resetTransferForm()
  showTransfer.value = true
}

function openTransferDir() {
  isTransferDir.value = true
  activeFile.value = null
  resetTransferForm()
  showTransfer.value = true
}

async function submitTransfer() {
  const inpath = isTransferDir.value ? currentDir.value : activeFile.value?.path
  if (!inpath) return
  showTransfer.value = false
  progressTitle.value = '手动转移 ' + inpath
  progressValue.value = 0
  progressText.value = '请稍候...'
  progressVisible.value = true
  startProgressPolling('filetransfer')
  try {
    const params: Record<string, unknown> = {
      inpath,
      syncmod: transferForm.value.syncmod,
      type: transferForm.value.type,
    }
    if (transferForm.value.outpath) params.outpath = transferForm.value.outpath
    if (transferForm.value.tmdb) params.tmdb = transferForm.value.tmdb
    if (transferForm.value.season) params.season = transferForm.value.season
    if (transferForm.value.min_filesize) params.min_filesize = transferForm.value.min_filesize
    if (transferForm.value.episode_format) params.episode_format = transferForm.value.episode_format
    if (transferForm.value.episode_details) params.episode_details = transferForm.value.episode_details
    if (transferForm.value.episode_offset) params.episode_offset = transferForm.value.episode_offset
    const res = await doAction<{ retcode: number; retmsg?: string }>('rename_udf', params)
    stopProgressPolling()
    if (res.retcode === 0) {
      progressValue.value = 100
      progressText.value = '转移成功！'
      setTimeout(() => {
        progressVisible.value = false
        showToast('转移成功')
        loadFiles(currentDir.value)
      }, 1500)
    } else {
      progressText.value = res.retmsg || '转移失败'
      setTimeout(() => {
        progressVisible.value = false
        showToast(res.retmsg || '转移失败')
      }, 1500)
    }
  } catch {
    stopProgressPolling()
    progressVisible.value = false
    showToast('转移失败')
  }
}

// ---- TMDB Search ----
function openTmdbSearch() {
  tmdbSearchKeyword.value = ''
  tmdbSearchResults.value = []
  showTmdbSearch.value = true
}

async function searchTmdb() {
  if (!tmdbSearchKeyword.value) return
  tmdbSearchLoading.value = true
  try {
    const res = await doAction<{ code: number; result?: TmdbSearchItem[] }>('search_media_infos', {
      keyword: tmdbSearchKeyword.value,
      searchtype: 'tmdb'
    })
    if (res.code === 0) tmdbSearchResults.value = res.result || []
    else showToast(res.msg || '搜索失败')
  } catch { showToast('搜索失败') }
  finally { tmdbSearchLoading.value = false }
}

function selectTmdb(item: TmdbSearchItem) {
  transferForm.value.tmdb = item.tmdb_id
  showTmdbSearch.value = false
}

function openHardlink(f: FileItem) {
  hardlinkPendingFiles.value = [f.path]
  if (currentDir.value === '/') {
    hardlinkDir.value = '/' + f.path.split('/')[1]
  } else {
    hardlinkDir.value = currentDir.value
  }
  hardlinkSearchDirVisible.value = true
}

function openHardlinkAll() {
  const filePaths = files.value.filter((f) => !f.is_dir).map((f) => f.path)
  if (filePaths.length === 0) {
    showToast('当前目录下没有文件')
    return
  }
  hardlinkPendingFiles.value = filePaths
  hardlinkDir.value = currentDir.value
  hardlinkSearchDirVisible.value = true
}

async function doHardlinkSearch() {
  if (!hardlinkDir.value) {
    showToast('请填写查找目录')
    return
  }
  hardlinkSearchDirVisible.value = false
  hardlinkLoading.value = true
  hardlinkVisible.value = true
  try {
    const res = await doAction<{ code: number; data?: Record<string, HardlinkFile[]> }>('find_hardlinks', {
      files: hardlinkPendingFiles.value,
      dir: hardlinkDir.value
    })
    if (res.code === 0) {
      if (res.data && Object.keys(res.data).length > 0) {
        hardlinkResults.value = res.data
      } else {
        hardlinkResults.value = {}
        modal.success('查询成功，但未找到硬链接文件')
        hardlinkVisible.value = false
      }
    } else {
      modal.error('查询硬链接文件失败')
      hardlinkVisible.value = false
    }
  } catch {
    modal.error('查询硬链接失败')
    hardlinkVisible.value = false
  } finally {
    hardlinkLoading.value = false
  }
}

function toggleHardlinkSelect(file: string) {
  const next = new Set(hardlinkSelected.value)
  if (next.has(file)) next.delete(file)
  else next.add(file)
  hardlinkSelected.value = next
}

function selectAllHardlinks() {
  hardlinkSelected.value = new Set(allHardlinkFiles.value)
}

function unselectAllHardlinks() {
  hardlinkSelected.value = new Set()
}

function invertHardlinkSelect() {
  const current = hardlinkSelected.value
  const next = new Set<string>()
  for (const f of allHardlinkFiles.value) {
    if (!current.has(f)) next.add(f)
  }
  hardlinkSelected.value = next
}

async function deleteSelectedHardlinks() {
  const files = Array.from(hardlinkSelected.value)
  if (files.length === 0) {
    showToast('没有硬链接文件被选中')
    return
  }
  const ok = await modal.confirm(
    '即将删除所有选中的硬链接文件，如文件所在目录已没有其它媒体文件则目录也将被删除，是否确认？',
    '删除硬链接'
  )
  if (!ok) return
  const res = await doAction<{ code: number; msg?: string }>('delete_files', { files })
  if (res.code === 0) {
    modal.success('删除成功')
    hardlinkVisible.value = false
  } else {
    modal.error(res.msg || '删除失败')
  }
}

function formatSize(s: string): string {
  if (!s) return ''
  const n = Number(s)
  if (Number.isNaN(n)) return s
  if (n < 1024) return n + 'B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + 'GB'
}
</script>

<template>
  <div class="mediafile page">
    <van-search
      v-model="pathInput"
      class="path-search"
      shape="round"
      placeholder="输入或粘贴目录路径"
      show-action
      @search="goInput"
    >
      <template #action><div class="search-action" @click="goInput">前往</div></template>
    </van-search>

    <div class="breadcrumb-bar">
      <div class="nav-btn" @click="goParent"><van-icon name="arrow-left" /></div>
      <div class="nav-btn" @click="openTree"><van-icon name="more-o" /></div>
      <div class="crumbs">
        <span
          v-for="(cr, i) in pathCrumbs" :key="i"
          class="crumb" :class="{ current: i === pathCrumbs.length - 1 }"
          @click="goPath(cr.path)"
        >{{ cr.label }}<span v-if="i < pathCrumbs.length - 1" class="crumb-sep">/</span></span>
      </div>
    </div>

    <div class="action-bar">
      <van-button size="small" plain hairline type="warning" icon="share-o" @click="openTransferDir">转移目录</van-button>
      <van-button size="small" plain hairline type="primary" icon="refresh" @click="loadFiles(currentDir)">刷新</van-button>
      <van-button size="small" plain hairline icon="link-o" @click="openHardlinkAll">所有硬链接</van-button>
    </div>

    <van-loading v-if="loading" size="24" class="page-loading" />

    <div v-else class="file-grid">
      <div v-for="f in files" :key="f.path" class="file-card">
        <div class="file-main" @click="onFileClick(f)">
          <div class="file-icon" :class="f.is_dir ? 'dir' : 'file'">
            <van-icon :name="f.is_dir ? 'orders-o' : 'description-o'" size="22" />
          </div>
          <div class="file-body">
            <div class="file-name">{{ f.name }}</div>
            <div class="file-meta">
              <span v-if="f.is_dir">文件夹</span>
              <span v-if="!f.is_dir && f.size">{{ formatSize(f.size) }}</span>
              <span v-if="f.ext">.{{ f.ext }}</span>
            </div>
          </div>
          <van-icon v-if="f.is_dir" name="arrow" class="dir-arrow" />
        </div>

        <template v-if="!f.is_dir">
          <div v-if="nameTestResults[f.path]" class="nt-result">
            <template v-if="parsedResults[f.path]">
              <div class="nt-head">
                <span class="nt-type" :style="{ background: mediaTypeColor(parsedResults[f.path].type) }">
                  {{ mediaTypeLabel(parsedResults[f.path].type) || '未知' }}
                </span>
                <span class="nt-name" @click="handleChipClick('name', f)">{{ parsedResults[f.path].title || '未命名' }}</span>
                <span v-if="parsedResults[f.path].year" class="nt-year">({{ parsedResults[f.path].year }})</span>
              </div>
              <div class="nt-chips">
                <span
                  v-if="parsedResults[f.path].season_episode"
                  class="nt-chip nt-chip-link"
                  @click="handleChipClick('season_episode', f)"
                >
                  <van-icon name="play-circle-o" />{{ parsedResults[f.path].season_episode }}
                </span>
                <span
                  v-if="parsedResults[f.path].tmdbid"
                  class="nt-chip nt-chip-link"
                  @click="handleChipClick('tmdbid', f)"
                >
                  <van-icon name="label-o" />TMDB {{ parsedResults[f.path].tmdbid }}
                </span>
                <span
                  v-if="parsedResults[f.path].title"
                  class="nt-chip nt-chip-link"
                  @click="handleChipClick('title', f)"
                >
                  <van-icon name="description-o" />复制标题
                </span>
              </div>
              <div v-if="hasTechInfo(parsedResults[f.path])" class="nt-chips">
                <span
                  v-for="key in techChipOrder" v-show="parsedResults[f.path][key]" :key="key"
                  class="nt-chip nt-chip-tech"
                >
                  {{ chipLabels[key] }} · {{ parsedResults[f.path][key] }}
                </span>
              </div>
            </template>
            <div v-else class="nt-fail">
              <van-icon name="warning-o" />
              <span>{{ (nameTestResults[f.path] as any).name }}</span>
            </div>
          </div>

          <div class="file-actions">
            <van-button
              size="small" plain hairline type="warning" icon="aim"
              :loading="nameTestLoading[f.path]"
              @click="doNameTest(f)"
            >识别</van-button>
            <van-button size="small" plain hairline type="primary" icon="exchange" @click="openTransferFile(f)">转移</van-button>
            <van-button size="small" plain hairline class="more-btn" icon="ellipsis" @click="openMoreActions(f)" />
          </div>
        </template>
      </div>
      <van-empty v-if="files.length === 0" class="grid-empty" description="目录为空" />
    </div>

    <!-- 更多操作：重命名 / 硬链接 / 删除 -->
    <van-action-sheet
      v-model:show="showMoreActions"
      :title="activeFile?.name || '操作'"
      :actions="moreActions"
      cancel-text="取消"
      close-on-click-action
      teleport="body"
      @select="(_, index) => onMoreActionSelect(index)"
    />

    <!-- 重命名 -->
    <van-popup v-model:show="showRename" position="bottom" round teleport="body" class="sheet">
      <van-form class="sheet-form" @submit="submitRename">
        <div class="sheet-header">
          <span class="sheet-title">重命名</span>
          <van-icon name="cross" class="sheet-close" @click="showRename = false" />
        </div>
        <div class="sheet-body">
          <div class="sheet-tip">原名称：{{ activeFile?.name }}</div>
          <van-cell-group inset class="form-group">
            <van-field
              v-model="renameNewName"
              label="新名称"
              placeholder="请输入新名称"
              clearable
              :rules="[{ required: true, message: '请输入新名称' }]"
            />
          </van-cell-group>
        </div>
        <div class="sheet-footer">
          <van-button block round type="primary" native-type="submit">确认重命名</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 手动转移 -->
    <van-popup v-model:show="showTransfer" position="bottom" round teleport="body" class="sheet sheet-tall">
      <van-form class="sheet-form" @submit="submitTransfer">
        <div class="sheet-header">
          <span class="sheet-title">{{ isTransferDir ? '转移目录' : '转移文件' }}</span>
          <van-icon name="cross" class="sheet-close" @click="showTransfer = false" />
        </div>
        <div class="sheet-body">
          <div class="form-path">
            <span class="form-path-label">输入路径</span>{{ isTransferDir ? currentDir : activeFile?.path }}
          </div>

          <div class="section-label">基本设置</div>
          <van-cell-group inset class="form-group">
            <van-field v-model="transferForm.outpath" label="输出路径" placeholder="留空使用默认" clearable />
            <van-field
              label="转移方式" is-link readonly
              :model-value="SYNC_MODS.find(o => o.value === transferForm.syncmod)?.text || transferForm.syncmod"
              placeholder="请选择"
              @click="openSyncmodPicker"
            />
            <van-field
              label="类型" is-link readonly
              :model-value="TYPE_OPTIONS.find(o => o.value === transferForm.type)?.text || transferForm.type"
              placeholder="请选择"
              @click="openTypePicker"
            />
            <van-field label="TMDB ID">
              <template #input>
                <div class="tmdb-input">
                  <van-tag v-if="transferForm.tmdb" size="medium" type="primary" closable @close="transferForm.tmdb = ''">
                    {{ transferForm.tmdb }}
                  </van-tag>
                  <span v-else class="tmdb-placeholder">留空自动识别</span>
                  <van-button size="small" plain hairline type="primary" icon="search" @click="openTmdbSearch">查询</van-button>
                </div>
              </template>
            </van-field>
          </van-cell-group>

          <template v-if="transferForm.type !== 'MOV'">
            <div class="section-label">剧集设置</div>
            <van-cell-group inset class="form-group">
              <van-field v-model="transferForm.season" label="季" placeholder="如 1" type="number" />
              <van-field v-model="transferForm.episode_format" label="集数定位" placeholder="如 {ep}" />
              <van-field v-model="transferForm.episode_details" label="起止集数" placeholder="如 1[,12]" />
              <van-field v-model="transferForm.episode_offset" label="集数偏移" placeholder="如 0" type="number" />
            </van-cell-group>
          </template>

          <div class="section-label">高级选项</div>
          <van-cell-group inset class="form-group">
            <van-field v-model="transferForm.min_filesize" label="最小大小" placeholder="单位 MB，如 200" type="number" />
          </van-cell-group>
        </div>
        <div class="sheet-footer">
          <van-button block round type="primary" native-type="submit" :loading="transferLoading">开始转移</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 转移进度遮罩 -->
    <van-overlay :show="progressVisible" :lock-scroll="false" class="progress-overlay">
      <div class="progress-box">
        <div class="progress-title">{{ progressTitle }}</div>
        <van-progress :percentage="progressValue" :stroke-width="10" style="margin:18px 0" />
        <div class="progress-text">{{ progressText }}</div>
      </div>
    </van-overlay>

    <!-- 转移方式选择器 -->
    <van-popup v-model:show="showSyncmodPicker" position="bottom" round teleport="body" @closed="showTransfer = true">
      <van-picker
        title="选择转移方式"
        :columns="SYNC_MODS"
        :default-index="SYNC_MODS.findIndex(s => s.value === transferForm.syncmod)"
        @confirm="({ selectedOptions }) => { transferForm.syncmod = selectedOptions[0].value; showSyncmodPicker = false }"
        @cancel="showSyncmodPicker = false"
      />
    </van-popup>

    <!-- 类型选择器 -->
    <van-popup v-model:show="showTypePicker" position="bottom" round teleport="body" @closed="showTransfer = true">
      <van-picker
        title="选择类型"
        :columns="TYPE_OPTIONS"
        :default-index="TYPE_OPTIONS.findIndex(t => t.value === transferForm.type)"
        @confirm="({ selectedOptions }) => { transferForm.type = selectedOptions[0].value; showTypePicker = false }"
        @cancel="showTypePicker = false"
      />
    </van-popup>

    <!-- TMDB 查询 -->
    <van-popup v-model:show="showTmdbSearch" position="bottom" round teleport="body" class="sheet sheet-tall-70">
      <div class="sheet-header">
        <span class="sheet-title">查询 TMDB ID</span>
        <van-icon name="cross" class="sheet-close" @click="showTmdbSearch = false" />
      </div>
      <van-search
        v-model="tmdbSearchKeyword"
        class="sheet-search"
        shape="round"
        placeholder="输入媒体标题"
        show-action
        @search="searchTmdb"
      >
        <template #action><div class="search-action" @click="searchTmdb">搜索</div></template>
      </van-search>
      <div class="sheet-body">
        <van-loading v-if="tmdbSearchLoading" size="20" class="body-loading" />
        <template v-else>
          <van-empty v-if="!tmdbSearchKeyword && tmdbSearchResults.length === 0" image="search" description="输入标题开始搜索" />
          <van-empty v-else-if="tmdbSearchResults.length === 0" description="无搜索结果" />
          <div v-else class="tmdb-list">
            <div v-for="item in tmdbSearchResults" :key="item.tmdb_id" class="tmdb-item" @click="selectTmdb(item)">
              <img v-if="item.image" :src="item.image" class="tmdb-poster" alt="" />
              <div v-else class="tmdb-poster tmdb-poster-empty"><van-icon name="photo-o" size="20" /></div>
              <div class="tmdb-info">
                <div class="tmdb-title">{{ item.title }}</div>
                <div v-if="item.year" class="tmdb-year">{{ item.year }}</div>
                <div v-if="item.overview" class="tmdb-overview">{{ item.overview }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </van-popup>

    <!-- 目录树 -->
    <van-popup v-model:show="showTree" position="bottom" round teleport="body" class="sheet sheet-tall-70">
      <div class="sheet-header">
        <span class="sheet-title">目录树</span>
        <van-icon name="cross" class="sheet-close" @click="showTree = false" />
      </div>
      <div class="tree-nav">
        <div class="nav-btn" :class="{ disabled: treePath === '/' }" @click="treeGoUp"><van-icon name="arrow-left" /></div>
        <div class="tree-path">{{ treePath }}</div>
      </div>
      <div class="sheet-body">
        <van-loading v-if="treeLoading" size="20" class="body-loading" />
        <template v-else>
          <div v-for="item in treeItems" :key="item.path" class="tree-node" @click="onTreeSelect(item)">
            <van-icon :name="item.is_dir ? 'folder-o' : 'description-o'" :color="item.is_dir ? '#ff976a' : '#1989fa'" size="18" />
            <span class="tree-node-label">{{ item.name }}</span>
            <span v-if="!item.is_dir && item.size" class="tree-node-size">{{ formatSize(item.size) }}</span>
            <van-icon v-if="item.is_dir" name="arrow" color="#c8c9cc" />
          </div>
          <van-empty v-if="treeItems.length === 0" description="目录为空" />
        </template>
      </div>
    </van-popup>

    <!-- 硬链接查询目录 -->
    <van-popup v-model:show="hardlinkSearchDirVisible" position="bottom" round teleport="body" class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">硬链接查询</span>
        <van-icon name="cross" class="sheet-close" @click="hardlinkSearchDirVisible = false" />
      </div>
      <div class="sheet-body">
        <div class="sheet-tip">将在下方目录中查找所选文件的硬链接</div>
        <van-cell-group inset class="form-group">
          <van-field v-model="hardlinkDir" label="查找目录" placeholder="输入查找目录" clearable @keyup.enter="doHardlinkSearch" />
        </van-cell-group>
      </div>
      <div class="sheet-footer">
        <van-button round plain hairline class="grow" @click="hardlinkSearchDirVisible = false">取消</van-button>
        <van-button round type="primary" class="grow" @click="doHardlinkSearch">开始查询</van-button>
      </div>
    </van-popup>

    <!-- 硬链接查询结果 -->
    <van-popup v-model:show="hardlinkVisible" position="bottom" round teleport="body" class="sheet sheet-tall-75">
      <div class="sheet-header">
        <span class="sheet-title">硬链接文件</span>
        <van-icon name="cross" class="sheet-close" @click="hardlinkVisible = false" />
      </div>
      <div class="sheet-body">
        <van-loading v-if="hardlinkLoading" size="20" class="body-loading" />
        <van-empty v-else-if="Object.keys(hardlinkResults).length === 0" description="暂无数据" />
        <template v-else>
          <div v-for="(links, file) in hardlinkResults" :key="file" class="hl-group">
            <div class="hl-file">
              <van-icon name="description-o" class="hl-file-icon" />
              <div class="hl-file-text">
                <div class="hl-file-name">{{ baseName(String(file)) }}</div>
                <div class="hl-file-path">{{ file }}</div>
              </div>
            </div>
            <div
              v-for="(h, idx) in links" :key="idx"
              class="hl-item" :class="{ 'hl-item-active': hardlinkSelected.has(h.file) }"
              @click="toggleHardlinkSelect(h.file)"
            >
              <van-checkbox :model-value="hardlinkSelected.has(h.file)" class="hl-check" />
              <div class="hl-item-text">
                <div class="hl-item-name">{{ h.filename }}</div>
                <div class="hl-item-path">{{ h.filepath }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
      <div v-if="!hardlinkLoading && Object.keys(hardlinkResults).length > 0" class="sheet-footer hl-footer">
        <van-button size="small" round plain hairline @click="allHardlinkSelected ? unselectAllHardlinks() : selectAllHardlinks()">
          {{ allHardlinkSelected ? '全不选' : '全选' }}
        </van-button>
        <van-button size="small" round plain hairline @click="invertHardlinkSelect">反选</van-button>
        <span class="hl-count">已选 {{ hardlinkSelected.size }} / {{ allHardlinkFiles.length }} 项</span>
        <van-button size="small" round type="danger" :disabled="hardlinkSelected.size === 0" @click="deleteSelectedHardlinks">
          删除
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.mediafile {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---- 顶部搜索 / 导航 ---- */
.path-search {
  padding: 4px 6px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(100, 101, 102, 0.08);
}
.search-action {
  color: var(--van-primary-color);
  font-size: 14px;
  font-weight: 500;
  padding: 0 6px;
  cursor: pointer;
}
.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: 0 1px 4px rgba(100, 101, 102, 0.08);
}
.nav-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f3f5;
  color: #646566;
  font-size: 16px;
  cursor: pointer;
}
.nav-btn:active { background: #e8eaee; }
.nav-btn.disabled { opacity: 0.35; }
.crumbs {
  display: flex;
  align-items: center;
  overflow-x: auto;
  white-space: nowrap;
  flex: 1;
  scrollbar-width: none;
}
.crumbs::-webkit-scrollbar { display: none; }
.crumb {
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #646566;
}
.crumb.current { color: #323233; font-weight: 600; }
.crumb-sep { margin: 0 4px; color: #dcdee0; }
.action-bar { display: flex; gap: 8px; }
.action-bar .van-button { flex: 1; }
.page-loading { display: block; margin: 60px auto; }

/* ---- 文件卡片网格（竖屏 1 列，横屏/宽屏多列） ---- */
.file-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.grid-empty { grid-column: 1 / -1; }
@media (min-width: 600px) {
  .file-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .file-grid { grid-template-columns: repeat(3, 1fr); }
}
.file-card {
  min-width: 0;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(100, 101, 102, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.file-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  cursor: pointer;
}
.file-main:active { opacity: 0.6; }
.file-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.file-icon.dir { background: #fff3e8; color: #ff976a; }
.file-icon.file { background: #e8f2ff; color: #1989fa; }
.file-body { flex: 1; min-width: 0; }
.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-meta {
  display: flex;
  gap: 8px;
  margin-top: 3px;
  font-size: 11px;
  color: #969799;
}
.dir-arrow { color: #c8c9cc; flex-shrink: 0; }
.file-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid #f2f3f5;
  padding-top: 10px;
}
.file-actions .van-button { flex: 1; }
.file-actions .more-btn { flex: 0 0 36px; }

/* ---- 识别结果 ---- */
.nt-result {
  background: #f7f8fa;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nt-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.nt-type {
  flex-shrink: 0;
  font-size: 10px;
  color: #fff;
  border-radius: 4px;
  padding: 2px 5px;
  line-height: 1.3;
}
.nt-name {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.nt-year { font-size: 12px; color: #969799; flex-shrink: 0; }
.nt-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.nt-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  border-radius: 6px;
  padding: 3px 7px;
  line-height: 1.4;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nt-chip .van-icon { font-size: 12px; }
.nt-chip-link { background: #e8f2ff; color: #1989fa; cursor: pointer; }
.nt-chip-link:active { background: #d6e8fd; }
.nt-chip-tech { background: #fff; color: #646566; border: 1px solid #ebedf0; }
.nt-fail {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ee0a24;
  font-size: 12px;
}

/* ---- 底部弹层通用 ---- */
.sheet {
  max-width: 640px;
  right: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
.sheet-tall { height: 88vh; height: 88dvh; }
.sheet-tall-70 { height: 72vh; height: 72dvh; }
.sheet-tall-75 { height: 78vh; height: 78dvh; }
.sheet-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.sheet-header {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 44px 12px;
  border-bottom: 1px solid #f2f3f5;
  background: #fff;
}
.sheet-title { font-size: 16px; font-weight: 600; color: #323233; }
.sheet-close {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #969799;
  background: #f2f3f5;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
}
.sheet-close:active { background: #e8eaee; }
.sheet-search { flex-shrink: 0; border-bottom: 1px solid #f2f3f5; }
.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
  background: #f7f8fa;
}
.sheet-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f2f3f5;
}
.sheet-footer .grow { flex: 1; }
.sheet-tip {
  font-size: 12px;
  color: #969799;
  margin: 0 4px 10px;
  word-break: break-all;
  line-height: 1.5;
}
.body-loading { display: block; margin: 40px auto; }

/* ---- 表单分组 ---- */
.section-label {
  font-size: 12px;
  color: #969799;
  font-weight: 500;
  margin: 2px 4px 8px;
}
.form-group { margin: 0 0 14px; border-radius: 12px; overflow: hidden; }
.form-path {
  background: #fff;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-size: 12px;
  color: #646566;
  word-break: break-all;
  line-height: 1.5;
}
.form-path-label { color: #969799; margin-right: 8px; }
.tmdb-input { display: flex; align-items: center; gap: 8px; width: 100%; }
.tmdb-placeholder { flex: 1; color: var(--van-field-placeholder-color, #c8c9cc); }
.tmdb-input .van-tag { flex-shrink: 0; }
.tmdb-input .van-button { margin-left: auto; flex-shrink: 0; }

/* ---- 目录树 ---- */
.tree-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f2f3f5;
  background: #fff;
  flex-shrink: 0;
}
.tree-path {
  flex: 1;
  font-size: 12px;
  color: #646566;
  overflow-x: auto;
  white-space: nowrap;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 10px;
  background: #fff;
  border-radius: 10px;
  margin-bottom: 6px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(100, 101, 102, 0.05);
}
.tree-node:active { background: #f2f3f5; }
.tree-node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #323233;
}
.tree-node-size { font-size: 11px; color: #969799; flex-shrink: 0; }

/* ---- TMDB 搜索结果 ---- */
.tmdb-list { display: flex; flex-direction: column; gap: 8px; }
.tmdb-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(100, 101, 102, 0.06);
}
.tmdb-item:active { background: #f7f8fa; }
.tmdb-poster {
  width: 46px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: #f2f3f5;
}
.tmdb-poster-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #dcdee0;
}
.tmdb-info { flex: 1; min-width: 0; }
.tmdb-title {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tmdb-year { font-size: 11px; color: #969799; margin-top: 2px; }
.tmdb-overview {
  font-size: 11px;
  color: #969799;
  margin-top: 4px;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ---- 硬链接结果 ---- */
.hl-group {
  background: #fff;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(100, 101, 102, 0.06);
}
.hl-file {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #ebedf0;
  margin-bottom: 6px;
}
.hl-file-icon { color: #1989fa; font-size: 16px; margin-top: 2px; flex-shrink: 0; }
.hl-file-text { flex: 1; min-width: 0; }
.hl-file-name {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hl-file-path { font-size: 11px; color: #969799; word-break: break-all; margin-top: 2px; }
.hl-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
}
.hl-item + .hl-item { margin-top: 2px; }
.hl-item:active { background: #f7f8fa; }
.hl-item-active { background: #e8f2ff; }
.hl-item-active:active { background: #dcebfb; }
.hl-check { flex-shrink: 0; margin-top: 2px; pointer-events: none; }
.hl-item-text { flex: 1; min-width: 0; }
.hl-item-name {
  font-size: 13px;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hl-item-path { font-size: 11px; color: #969799; word-break: break-all; margin-top: 2px; }
.hl-footer .van-button { flex: 0 0 auto; }
.hl-count { flex: 1; text-align: right; font-size: 12px; color: #969799; }

/* ---- 进度遮罩 ---- */
.progress-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}
.progress-box {
  width: min(320px, 78vw);
  padding: 22px 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
}
.progress-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.progress-text { font-size: 12px; color: #969799; text-align: center; word-break: break-all; }
</style>
