<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'
import { nameTest, refreshProcess, type NameTestData, type RefreshProcessResult } from '@/api/system'

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

type NameTestResult = NameTestData | { name: string }

const chipOrder = ['name', 'year', 'season_episode', 'title', 'tmdbid', 'restype', 'pix', 'video_codec', 'audio_codec', 'team']

const chipLabels: Record<string, string> = {
  name: '名称', year: '年份', season_episode: '季集', title: '标题',
  tmdbid: 'TMDB ID', restype: '质量', pix: '分辨率',
  video_codec: '视频编码', audio_codec: '音频编码', team: '制作组'
}

const chipTypes: Record<string, string> = {
  name: 'warning', year: 'warning', season_episode: 'warning',
  title: 'success', tmdbid: 'success', team: 'primary'
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

// Action sheet for rename/delete
const showMoreActions = ref(false)
const activeFile = ref<FileItem | null>(null)

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

function startProgressPolling(type: string) {
  stopProgressPolling()
  async function poll() {
    try {
      const res = await refreshProcess(type)
      if (res.code === 0 && res.value <= 100) {
        progressValue.value = res.value
        progressText.value = res.text
      }
    } catch {}
    progressTimer = setTimeout(poll, 200)
  }
  poll()
}

function stopProgressPolling() {
  if (progressTimer) {
    clearTimeout(progressTimer)
    progressTimer = null
  }
}

const defaultSyncmod = ref('copy')
const showSyncmodPicker = ref(false)
const SYNC_MODS = [
  { text: '硬链接', value: 'link' },
  { text: '软链接', value: 'softlink' },
  { text: '复制', value: 'copy' },
  { text: '移动', value: 'move' },
  { text: 'Rclone复制', value: 'rclonecopy' },
  { text: 'Rclone移动', value: 'rclone' },
  { text: 'Minio复制', value: 'miniocopy' },
  { text: 'Minio移动', value: 'minio' },
]

function openSyncmodPicker() {
  showTransfer.value = false
  nextTick(() => {
    showSyncmodPicker.value = true
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

function handleChipClick(key: string, f: FileItem) {
  if (!clickableChips.has(key)) return
  const result = nameTestResults[f.path]
  if (!result || !isNameTestResult(result)) return
  if (key === 'title') {
    navigator.clipboard?.writeText(result.title).then(() => showToast('已复制标题')).catch(() => {})
  } else if (key === 'tmdbid') {
    const v = String(result.tmdbid)
    navigator.clipboard?.writeText(v).then(() => showToast('已复制 TMDB ID')).catch(() => {})
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
    <div class="toolbar">
      <van-field v-model="pathInput" placeholder="输入目录路径" @keyup.enter="goInput">
        <template #left-icon><van-icon name="search" @click="goInput" /></template>
        <template #button><van-button size="small"  plain @click="goInput">前往</van-button></template>
      </van-field>
    </div>

    <div class="breadcrumb-bar">
      <van-icon name="arrow-left" @click="goParent" style="cursor:pointer;flex-shrink:0" />
      <van-icon name="folder-o" @click="openTree" style="cursor:pointer;flex-shrink:0;margin-left:8px" />
      <div class="crumbs">
        <span v-for="(cr, i) in pathCrumbs" :key="i" class="crumb" @click="goPath(cr.path)">
          {{ cr.label }}<span v-if="i < pathCrumbs.length - 1" class="crumb-sep">/</span>
        </span>
      </div>
    </div>

    <div class="action-bar">
      <van-button size="small"  plain type="warning" icon="share-o" @click="openTransferDir">转移目录</van-button>
      <van-button size="small"  plain type="primary" icon="refresh" @click="loadFiles(currentDir)">刷新</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <div v-else class="file-grid">
      <div v-for="f in files" :key="f.path" class="file-card" :class="{ 'file-card-dir': f.is_dir }">
        <div class="file-icon" @click="onFileClick(f)">
          <van-icon :name="f.is_dir ? 'folder-o' : 'description-o'" :color="f.is_dir ? '#ff976a' : '#1989fa'" size="26" />
        </div>
        <div class="file-body" @click="onFileClick(f)">
          <div class="file-name">{{ f.name }}</div>
          <div class="file-meta">
            <span v-if="!f.is_dir && f.size">{{ formatSize(f.size) }}</span>
            <span v-if="f.ext">.{{ f.ext }}</span>
          </div>
          <div v-if="nameTestResults[f.path]" class="chips-row">
            <template v-if="isNameTestResult(nameTestResults[f.path])">
              <van-tag
                v-for="key in chipOrder" :key="key"
                v-show="(nameTestResults[f.path] as NameTestData)[key as keyof NameTestData]"
                :type="(chipTypes[key] as any) || 'default'"
                size="small"
                :class="{ 'chip-clickable': clickableChips.has(key) }"
                @click="handleChipClick(key, f)"
              >
                {{ chipLabels[key] || key }}: {{ (nameTestResults[f.path] as NameTestData)[key as keyof NameTestData] }}
              </van-tag>
            </template>
            <van-tag v-else type="danger" size="small">
              {{ (nameTestResults[f.path] as any).name }}
            </van-tag>
          </div>
        </div>
        <div class="file-actions">
          <template v-if="f.is_dir">
            <van-button size="small" plain type="primary" icon="arrow" @click="loadFiles(f.path)">进入</van-button>
          </template>
          <template v-else>
            <van-button
              size="small"  plain type="warning"
              :loading="nameTestLoading[f.path]"
              @click="doNameTest(f)"
            >识别</van-button>
            <van-button size="small"  plain type="primary" @click="openTransferFile(f)">转移</van-button>
            <van-icon name="ellipsis" color="#c8c9cc" size="20" @click="openMoreActions(f)" />
          </template>
        </div>
      </div>
      <van-empty v-if="files.length === 0" description="目录为空" />
    </div>

    <!-- More actions: rename / delete -->
    <van-action-sheet v-model:show="showMoreActions" :title="activeFile?.name || ''">
      <div style="padding:16px;display:flex;gap:12px">
        <van-button  block plain @click="activeFile && doRename(activeFile)" icon="edit">重命名</van-button>
        <van-button  block plain type="danger" @click="activeFile && doDelete(activeFile)" icon="delete">删除</van-button>
      </div>
    </van-action-sheet>

    <van-popup v-model:show="showRename" position="bottom"  :style="{ height: '30%' }" closeable title="重命名">
      <van-form @submit="submitRename" style="padding:16px">
        <van-field v-model="renameNewName" label="新名称" :rules="[{ required: true }]" />
        <van-button  block type="primary" native-type="submit">确认</van-button>
      </van-form>
    </van-popup>

    <van-popup v-model:show="showTransfer" position="bottom"  :style="{ height: '85%' }" closeable :title="isTransferDir ? '转移目录' : '转移文件'">
      <van-form @submit="submitTransfer" style="padding:16px">
        <van-cell :title="'输入路径'" :value="isTransferDir ? currentDir : activeFile?.path" title-style="font-size:13px" value-style="font-size:11px;color:#969799;word-break:break-all" />
        <van-field v-model="transferForm.outpath" label="输出路径" placeholder="留空使用默认" />
        <van-field
          name="syncmod" label="转移方式" is-link readonly
          :model-value="SYNC_MODS.find(o => o.value === transferForm.syncmod)?.text || transferForm.syncmod"
          @click="openSyncmodPicker"
        />
        <van-field name="type" label="类型">
          <template #input>
            <van-radio-group v-model="transferForm.type" direction="horizontal">
              <van-radio name="MOV" shape="square">电影</van-radio>
              <van-radio name="TV" shape="square">电视剧</van-radio>
              <van-radio name="ANIME" shape="square">动漫</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field name="tmdb" label="TMDB ID" placeholder="留空自动识别">
          <template #button><van-button size="small"  plain @click="openTmdbSearch">查询</van-button></template>
          <template #input>
            <van-tag v-if="transferForm.tmdb" size="medium" closable @close="transferForm.tmdb = ''" style="margin-right:4px">{{ transferForm.tmdb }}</van-tag>
          </template>
        </van-field>
        <van-field v-if="transferForm.type !== 'MOV'" v-model="transferForm.season" label="季" placeholder="电视剧时填写" type="number" />
        <van-field v-model="transferForm.min_filesize" label="最小文件大小(MB)" placeholder="如 200" type="number" />
        <van-field v-if="transferForm.type !== 'MOV'" v-model="transferForm.episode_format" label="集数定位格式" placeholder="如 {ep}" />
        <van-field v-if="transferForm.type !== 'MOV'" v-model="transferForm.episode_details" label="起始集[,终止集]" placeholder="如 1[,12]" />
        <van-field v-if="transferForm.type !== 'MOV'" v-model="transferForm.episode_offset" label="集数偏移" placeholder="如 0" type="number" />
        <div style="margin-top:16px">
          <van-button  block type="primary" native-type="submit" :loading="transferLoading">开始转移</van-button>
        </div>
      </van-form>
    </van-popup>

    <!-- 转移进度遮罩 -->
    <van-overlay :show="progressVisible" :lock-scroll="false" style="display:flex;align-items:center;justify-content:center">
      <div class="progress-box">
        <div class="progress-title">{{ progressTitle }}</div>
        <van-progress :percentage="progressValue" :stroke-width="16" :show-pivot="false" style="margin:16px 0" />
        <div class="progress-text">{{ progressText }}</div>
      </div>
    </van-overlay>

    <van-popup v-model:show="showSyncmodPicker" position="bottom"  teleport="body" @closed="showTransfer = true">
      <van-picker
        :columns="SYNC_MODS"
        :default-index="SYNC_MODS.findIndex(s => s.value === transferForm.syncmod)"
        @confirm="({ selectedValues, selectedOptions }) => { transferForm.syncmod = selectedOptions[0].value;console.info(transferForm.syncmod); showSyncmodPicker = false }"
        @cancel="showSyncmodPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showTmdbSearch" position="bottom"  :style="{ height: '70%' }" closeable title="查询TMDB ID">
      <div style="padding:56px 12px 12px">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <van-field v-model="tmdbSearchKeyword" placeholder="输入标题" style="flex:1" @keyup.enter="searchTmdb" />
          <van-button size="small"  plain type="primary" @click="searchTmdb">搜索</van-button>
        </div>
        <van-loading v-if="tmdbSearchLoading" size="16" style="padding:20px;text-align:center" />
        <van-empty v-else-if="tmdbSearchKeyword && tmdbSearchResults.length === 0" description="无搜索结果" />
        <div v-else>
          <div v-for="item in tmdbSearchResults" :key="item.tmdb_id" class="tmdb-item" @click="selectTmdb(item)">
            <img v-if="item.image" :src="item.image" class="tmdb-poster" />
            <div class="tmdb-info">
              <div class="tmdb-title">{{ item.title }}</div>
              <div class="tmdb-year" v-if="item.year">{{ item.year }}</div>
              <div class="tmdb-overview" v-if="item.overview">{{ item.overview }}</div>
            </div>
          </div>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="showTree" position="bottom"  :style="{ height: '65%' }" closeable title="目录树">
      <div style="padding:8px 12px;overflow-y:auto;max-height:calc(65vh - 50px)">
        <div class="tree-nav">
          <van-icon name="arrow-left" :style="{ opacity: treePath !== '/' ? 1 : 0.3 }" @click="treeGoUp" />
          <div class="tree-crumbs" style="margin-left:8px;font-size:13px;color:#646566">{{ treePath }}</div>
        </div>
        <van-loading v-if="treeLoading" size="16" style="padding:20px;text-align:center" />
        <template v-else>
          <div v-for="item in treeItems" :key="item.path" class="tree-node" @click="onTreeSelect(item)">
            <van-icon :name="item.is_dir ? 'folder-o' : 'description-o'" :color="item.is_dir ? '#ff976a' : '#1989fa'" size="20" />
            <span class="tree-node-label">{{ item.name }}</span>
            <span v-if="!item.is_dir && item.size" class="tree-node-size">{{ formatSize(item.size) }}</span>
            <van-icon v-if="item.is_dir" name="arrow" color="#c8c9cc" style="margin-left:auto" />
          </div>
          <van-empty v-if="treeItems.length === 0" description="目录为空" />
        </template>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.mediafile { padding: 8px; }
.toolbar { margin-bottom: 8px; }
.breadcrumb-bar { display:flex;align-items:center;gap:4px;padding:6px 4px;font-size:13px;color:#646566;overflow:hidden; }
.crumbs { display:flex;overflow-x:auto;white-space:nowrap;flex:1;margin-left:8px; }
.crumb { cursor:pointer;flex-shrink:0; }
.crumb-sep { margin:0 2px;color:#c8c9cc; }
.action-bar { display:flex;gap:8px;padding:4px 4px 8px; }
.file-grid { display:flex;flex-direction:column;gap:6px; }
.file-card {
  display:flex;align-items:flex-start;gap:10px;padding:12px;
  background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);
}
.file-icon { padding-top:2px;flex-shrink:0; }
.file-body { flex:1;overflow:hidden;min-width:0; }
.file-name { font-size:14px;font-weight:600;color:#323233;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.file-meta { font-size:11px;color:#969799;gap:6px;display:flex;margin-top:2px; }
.chips-row { display:flex;flex-wrap:wrap;gap:4px;margin-top:6px; }
.chip-clickable { cursor:pointer; }
.file-actions { display:flex;align-items:center;gap:8px;flex-shrink:0;padding-top:2px; }
.file-card-dir { align-items: center; }
.file-card-dir .file-actions { padding-top: 0; }
.tree-node {
  display:flex;align-items:center;gap:8px;padding:10px 8px;cursor:pointer;border-bottom:1px solid #f5f5f5;
  font-size:14px;
}
.tree-node:active { background:#f5f5f5; }
.tree-node-label { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.tree-node-size { font-size:11px;color:#969799;flex-shrink:0; }
.tree-nav { display:flex;align-items:center;gap:8px;padding:6px 0 10px;border-bottom:1px solid #f5f5f5;margin-bottom:8px; }
.tree-crumbs { display:flex;overflow-x:auto;white-space:nowrap;font-size:13px;color:#646566; }
.tmdb-item {
  display:flex;align-items:center;gap:10px;padding:10px;cursor:pointer;border-bottom:1px solid #f5f5f5;
}
.tmdb-poster { width:40px;height:56px;object-fit:cover;border-radius:4px;flex-shrink:0; }
.tmdb-info { flex:1;overflow:hidden; }
.tmdb-title { font-size:13px;font-weight:600;color:#323233;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.tmdb-year { font-size:11px;color:#969799; }
.progress-box {
  width:280px;padding:24px;background:#fff;border-radius:12px;text-align:center;
}
.progress-title { font-size:14px;color:#323233;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.progress-text { font-size:13px;color:#969799; }
.tmdb-overview { font-size:11px;color:#969799;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical; }
</style>
