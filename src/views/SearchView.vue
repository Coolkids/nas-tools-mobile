<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  search, getSearchTaskList, getSearchTaskResult, searchTaskDelete,
  type SearchTaskItem, type SearchTaskResultItem, type TaskTmdbInfo
} from '@/api/media'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'
import { getDownloadSettings, getDownloadDirs, downloadSearchItem, type DownloadSettingOption } from '@/api/download'
import AddRssMediaDialog from '@/components/AddRssMediaDialog.vue'

const route = useRoute()
const modal = useModalStore()

const keyword = ref((route.query.q as string) || '')
const searching = ref(false)
const tasks = ref<SearchTaskItem[]>([])

const selectedTask = ref<SearchTaskItem | null>(null)
const taskResults = ref<SearchTaskResultItem[]>([])
const loadingResults = ref(false)
const tmdbInfo = ref<TaskTmdbInfo | null>(null)

const siteFilter = ref<string[]>([])
const nameFilter = ref('')
const showResults = ref(false)
const showSiteFilter = ref(false)

let taskPollTimer: ReturnType<typeof setInterval> | null = null

const uniqueSites = computed(() => {
  const sites = new Set(taskResults.value.map(r => r.site).filter(Boolean))
  return Array.from(sites).sort()
})

const filteredResults = computed(() => {
  let results = taskResults.value
  if (siteFilter.value.length > 0) {
    results = results.filter(r => siteFilter.value.includes(r.site))
  }
  if (nameFilter.value.trim()) {
    const q = nameFilter.value.trim().toLowerCase()
    results = results.filter(r => (r.torrent_name || '').toLowerCase().includes(q))
  }
  return results
})

function statusTag(status: string): { color: string; text: string } {
  switch (status) {
    case 'running': return { color: 'var(--van-orange)', text: '运行中' }
    case 'queued': return { color: 'var(--van-blue)', text: '排队中' }
    case 'success': return { color: 'var(--van-green)', text: '完成' }
    case 'failed': return { color: 'var(--van-red)', text: '失败' }
    default: return { color: 'var(--van-gray-6)', text: status }
  }
}

function formatTime(t: string): string {
  if (!t) return '-'
  return t
}

async function fetchTaskList() {
  try {
    const res = await getSearchTaskList()
    if (res.code === 0) {
      tasks.value = res.tasks || []
    }
  } catch { }
}

async function doSearch() {
  const q = keyword.value.trim()
  if (!q) {
    modal.warning('请输入搜索关键字')
    return
  }
  searching.value = true
  try {
    const res = await search({ search_word: q })
    if (res.code !== 0 && res.msg) {
      modal.error(res.msg)
    }
  } catch (e) {
    modal.error(e instanceof Error ? e.message : '搜索请求失败')
  }
  await fetchTaskList()
  searching.value = false
}

async function deleteTask(task: SearchTaskItem) {
  const confirmed = await modal.confirm(`确定删除任务「${task.keyword}」吗？`)
  if (!confirmed) return
  try {
    const res = await searchTaskDelete(task.keyword)
    if (res.code === 0) {
      modal.success(`任务已删除`)
      if (selectedTask.value?.keyword === task.keyword) {
        selectedTask.value = null
        taskResults.value = []
        tmdbInfo.value = null
      }
      await fetchTaskList()
    } else {
      modal.error(res.msg || '删除失败')
    }
  } catch (e) {
    modal.error(e instanceof Error ? e.message : '删除请求失败')
  }
}

async function selectTask(task: SearchTaskItem) {
  selectedTask.value = task
  showResults.value = true
  siteFilter.value = []
  nameFilter.value = ''
  if (task.status === 'success' || task.status === 'failed') {
    await loadTaskResult(task.keyword)
  }
}

async function loadTaskResult(kw: string) {
  loadingResults.value = true
  tmdbInfo.value = null
  try {
    const res = await getSearchTaskResult(kw)
    if (res.code === 0) {
      taskResults.value = res.results || []
      selectedTask.value = res.task as SearchTaskItem
      if (res.tmdb_info && (res.tmdb_info.poster || res.tmdb_info.overview)) {
        tmdbInfo.value = res.tmdb_info
      }
    }
  } catch { }
  loadingResults.value = false
  recalcTable()
}

function startTaskPoll() {
  if (taskPollTimer) return
  taskPollTimer = setInterval(fetchTaskList, 5000)
}

function stopTaskPoll() {
  if (taskPollTimer) {
    clearInterval(taskPollTimer)
    taskPollTimer = null
  }
}

function freeText(t: SearchTaskResultItem): { text: string; color: string } | null {
  if (t.download_volume_factor === 0) return { text: 'FREE', color: 'var(--van-green)' }
  if (t.download_volume_factor !== 1) return { text: `${Math.round(t.download_volume_factor * 100)}%DL`, color: 'var(--van-blue)' }
  return null
}

function uploadText(t: SearchTaskResultItem): { text: string; color: string } | null {
  if (t.upload_volume_factor !== 1) return { text: `${Math.round(t.upload_volume_factor * 100)}%UL`, color: 'var(--van-orange)' }
  return null
}

function openPage(url: string) {
  if (url) window.open(url, '_blank')
}

// ---- Results table ----
const vxeTableRef = ref()
const resultsMainRef = ref<HTMLElement>()
const tableHeight = ref(300)

function recalcTable() {
  nextTick(() => {
    const main = resultsMainRef.value
    if (!main) return
    const filterBar = main.querySelector('.filter-bar') as HTMLElement | null
    const used = filterBar ? filterBar.offsetHeight + 8 : 0
    // clientHeight 含上下 padding，需减去，否则表格会超出底部（竖屏 padding 为 12px）
    const style = getComputedStyle(main)
    const vPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    tableHeight.value = Math.max(200, main.clientHeight - used - vPadding)
    vxeTableRef.value?.recalculate()
  })
}

function onWindowResize() {
  if (showResults.value) recalcTable()
}

function toggleSite(s: string) {
  const idx = siteFilter.value.indexOf(s)
  if (idx >= 0) siteFilter.value.splice(idx, 1)
  else siteFilter.value.push(s)
}

// ---- Download ----
const showDownload = ref(false)
const downloadSettings = ref<DownloadSettingOption[]>([])
const savePaths = ref<string[]>([])
const downloadForm = reactive({ dl_setting: '' as string | number, dl_dir: '' })
const pendingTorrent = ref<SearchTaskResultItem | null>(null)
const submitting = ref(false)
const showDlSettingPicker = ref(false)
const showDirPicker = ref(false)

async function openDownload(t: SearchTaskResultItem) {
  if (!t.id) {
    modal.info('无可用下载链接')
    return
  }
  pendingTorrent.value = t
  downloadForm.dl_setting = ''
  downloadForm.dl_dir = ''
  await fetchDownloadSettings()
  showDownload.value = true
}

async function fetchDownloadSettings() {
  try {
    const res = await getDownloadSettings()
    if (res.code === 0) downloadSettings.value = res.data || []
  } catch {
    downloadSettings.value = []
  }
}

async function onDownloadSettingChange(val: string | number) {
  downloadForm.dl_dir = ''
  if (!val) { savePaths.value = []; return }
  try {
    const res = await getDownloadDirs(val)
    if (res.code === 0) savePaths.value = res.paths || []
  } catch {
    savePaths.value = []
  }
}

async function submitDownload() {
  if (!pendingTorrent.value?.id) return
  submitting.value = true
  try {
    const res = await downloadSearchItem(pendingTorrent.value.id, downloadForm.dl_dir, downloadForm.dl_setting)
    if (res.retcode === 0) {
      modal.success(`添加下载成功！`)
      showDownload.value = false
    } else {
      modal.error(res.retmsg || '添加下载失败')
    }
  } catch (e) {
    modal.error(e instanceof Error ? e.message : '添加下载失败')
  } finally {
    submitting.value = false
  }
}

// ---- RSS Subscribe ----
const showRss = ref(false)
const rssTask = ref<SearchTaskItem | null>(null)
const seasonOptions = computed(() => {
  const options = [{ value: '', label: '全部' }]
  for (let i = 1; i <= 20; i++) {
    options.push({ value: `S${i.toString().padStart(2, '0')}`, label: `第${i}季` })
  }
  return options
})

function openRssSubscribe(task: SearchTaskItem) {
  rssTask.value = task
  showRss.value = true
}

// ---- Advanced Search ----
const showAdvanced = ref(false)
const advancedForm = reactive({
  type: '', name: '', year: '', season: '',
  restype: '', pix: '', sp_state: '* *', rule: ''
})

const restypeDict: Record<string, string> = {
  BLURAY: 'BluRay', REMUX: 'REMUX', DOLBY: 'Dolby',
  WEB: 'WEB-DL', HDTV: 'HDTV', UHD: 'UHD', HDR: 'HDR', '3D': '3D'
}

const pixDict: Record<string, string> = {
  '8k': '8K', '4k': '4K', '1080p': '1080p', '720p': '720p'
}

const spStates = [
  { value: '* *', label: '全部' },
  { value: '1.0 1.0', label: '普通' },
  { value: '1.0 0.0', label: '免费' },
  { value: '2.0 1.0', label: '2X' },
  { value: '2.0 0.0', label: '2X免费' },
  { value: '1.0 0.5', label: '50%' },
  { value: '2.0 0.5', label: '2X 50%' },
  { value: '1.0 0.7', label: '70%' },
  { value: '1.0 0.3', label: '30%' }
]

interface RuleOption { id: number; name: string }
const filterRules = ref<RuleOption[]>([])

async function loadFilterRules() {
  try {
    const res: any = await doAction('get_filterrules', {})
    if (res.code === 0) {
      filterRules.value = (res.ruleGroups || []).map((g: any) => ({
        id: g.id, name: g.name
      }))
    }
  } catch { }
}

function openAdvancedDialog() {
  advancedForm.type = ''
  advancedForm.name = keyword.value || ''
  advancedForm.year = ''
  advancedForm.season = ''
  advancedForm.restype = ''
  advancedForm.pix = ''
  advancedForm.sp_state = '* *'
  advancedForm.rule = ''
  loadFilterRules()
  showAdvanced.value = true
}

async function doAdvancedSearch() {
  const name = advancedForm.name.trim()
  if (!name) { modal.warning('请输入电影/电视剧名称'); return }
  let kw = name
  if (advancedForm.type) kw = advancedForm.type + ' ' + name
  if (advancedForm.year) kw = kw + ' ' + advancedForm.year
  if (advancedForm.season) kw = kw + ' ' + advancedForm.season
  const filters: Record<string, string> = {}
  if (advancedForm.restype) filters.restype = advancedForm.restype
  if (advancedForm.pix) filters.pix = advancedForm.pix
  if (advancedForm.sp_state && advancedForm.sp_state !== '* *') filters.sp_state = advancedForm.sp_state
  if (advancedForm.rule) filters.rule = advancedForm.rule
  showAdvanced.value = false
  keyword.value = kw
  searching.value = true
  try {
    const res = await search({ search_word: kw, filters, unident: true })
    if (res.code !== 0 && res.msg) modal.error(res.msg)
  } catch (e) {
    modal.error(e instanceof Error ? e.message : '搜索请求失败')
  }
  await fetchTaskList()
  searching.value = false
}

onMounted(() => {
  fetchTaskList()
  startTaskPoll()
  window.addEventListener('resize', onWindowResize)
  if (keyword.value) doSearch()
})
onBeforeUnmount(() => {
  stopTaskPoll()
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <div class="search-view">
    <div class="search-bar">
      <van-search
        v-model="keyword"
        shape="round"
        placeholder="搜索电影、电视剧资源..."
        show-action
        :loading="searching"
        @search="doSearch"
      >
        <template #action>
          <div class="header-actions">
            <van-button size="small" type="primary" :loading="searching" @click="doSearch">
              {{ searching ? '搜索中' : '搜索' }}
            </van-button>
            <van-button size="small" plain @click="openAdvancedDialog">高级</van-button>
          </div>
        </template>
      </van-search>
    </div>

    <div class="task-header">
      <span class="task-count">共 {{ tasks.length }} 个任务</span>
      <van-button size="small" plain icon="replay" @click="fetchTaskList">刷新</van-button>
    </div>

    <div v-if="tasks.length === 0" class="empty-tip">
      <van-empty description="暂无搜索任务，输入关键词搜索资源" />
    </div>

    <div v-else class="task-list">
      <div
        v-for="task in tasks"
        :key="task.keyword"
        class="task-card"
        @click="selectTask(task)"
      >
        <div class="task-top">
          <span class="task-keyword">{{ task.keyword }}</span>
          <span
            class="task-status"
            :style="{ color: statusTag(task.status).color }"
          >{{ statusTag(task.status).text }}</span>
        </div>
        <div class="task-times">
          <span>{{ formatTime(task.start_time) }}</span>
          <template v-if="task.end_time">
            <span class="task-arrow">→</span>
            <span>{{ formatTime(task.end_time) }}</span>
          </template>
        </div>
        <div v-if="task.message" class="task-msg">{{ task.message }}</div>
        <div class="task-actions" @click.stop>
          <van-button
            size="mini"
            type="success"
            plain
            icon="plus"
            @click="openRssSubscribe(task)"
          >订阅</van-button>
          <van-button
            v-if="task.status === 'success' || task.status === 'failed'"
            size="mini"
            type="danger"
            plain
            icon="delete"
            @click="deleteTask(task)"
          />
        </div>
      </div>
    </div>

    <!-- Results Popup -->
    <van-popup
      v-model:show="showResults"
      position="right"
      :style="{ width: '100%', height: '100%' }"
      @opened="recalcTable"
    >
      <div class="results-popup">
        <div class="popup-header">
          <div class="popup-back" @click="showResults = false">
            <van-icon name="arrow-left" />
          </div>
          <div class="popup-title">{{ selectedTask ? `搜索结果：${selectedTask.keyword}` : '搜索结果' }}</div>
          <div v-if="taskResults.length > 0" class="popup-count">{{ filteredResults.length }} 条</div>
        </div>

        <div v-if="loadingResults" class="loading-tip">
          <van-loading size="16" /> 加载中...
        </div>

        <template v-else-if="taskResults.length > 0">
          <div class="results-body">
            <div v-if="tmdbInfo" class="tmdb-panel">
              <img v-if="tmdbInfo.poster" :src="tmdbInfo.poster" class="tmdb-poster" alt="poster">
              <div class="tmdb-meta">
                <div class="tmdb-title">
                  {{ tmdbInfo.title }}
                  <span v-if="tmdbInfo.year" class="tmdb-year">({{ tmdbInfo.year }})</span>
                </div>
                <div v-if="tmdbInfo.overview" class="tmdb-overview">{{ tmdbInfo.overview }}</div>
              </div>
            </div>

            <div ref="resultsMainRef" class="results-main">
              <div class="filter-bar">
                <van-field
                  v-model="nameFilter"
                  placeholder="名称过滤..."
                  clearable
                  class="filter-input"
                />
                <van-button
                  size="small"
                  :type="siteFilter.length > 0 ? 'primary' : 'default'"
                  plain
                  class="filter-site-btn"
                  @click="showSiteFilter = true"
                >
                  {{ siteFilter.length > 0 ? `站点(${siteFilter.length})` : '站点筛选' }}
                </van-button>
              </div>

              <vxe-table
                ref="vxeTableRef"
                :data="filteredResults"
                :height="tableHeight"
                border
                stripe
                size="small"
                class="results-table"
                :virtual-y-config="{ enabled: true, gt: 0 }"
                :row-config="{ isHover: false }"
              >
                <vxe-column field="site" title="站点" width="60">
                  <template #default="{ row }">
                    <span class="site-cell">{{ row.site }}</span>
                  </template>
                </vxe-column>
                <vxe-column field="torrent_name" title="种子名称" min-width="160">
                  <template #default="{ row }">
                    <div class="cell-name">{{ row.torrent_name }}</div>
                    <div class="cell-badges">
                      <van-tag v-if="row.title" size="small" type="primary">{{ row.title }}</van-tag>
                      <van-tag v-if="row.type === 'MOV'" size="small" type="success">电影</van-tag>
                      <van-tag v-else-if="row.type === 'TV'" size="small" type="warning">电视剧</van-tag>
                      <van-tag v-if="row.size" size="small" plain>{{ row.size }}</van-tag>
                      <van-tag v-if="uploadText(row)" size="small" :color="uploadText(row)!.color">{{ uploadText(row)!.text }}</van-tag>
                      <van-tag v-if="freeText(row)" size="small" :color="freeText(row)!.color">{{ freeText(row)!.text }}</van-tag>
                    </div>
                  </template>
                </vxe-column>
                <vxe-column field="seeders" title="做种" width="52" align="center">
                  <template #default="{ row }">
                    <span v-if="row.seeders" class="seeders-cell">{{ row.seeders }}</span>
                    <span v-else>-</span>
                  </template>
                </vxe-column>
                <vxe-column title="操作" width="62" align="center">
                  <template #default="{ row }">
                    <div class="cell-actions">
                      <van-button size="mini" type="primary" @click.stop="openDownload(row)">下载</van-button>
                      <van-icon v-if="row.pageurl" name="link-o" class="action-link" @click.stop="openPage(row.pageurl)" />
                    </div>
                  </template>
                </vxe-column>
                <template #empty>
                  <van-empty description="无匹配结果" image-size="60" />
                </template>
              </vxe-table>
            </div>
          </div>
        </template>

        <van-empty v-else-if="!loadingResults" description="暂无搜索结果" />
      </div>
    </van-popup>

    <!-- Site Filter Popup -->
    <van-popup v-model:show="showSiteFilter" position="bottom" round :style="{ maxHeight: '60%' }">
      <div class="site-filter">
        <div class="site-filter-header">
          <span class="site-filter-title">站点筛选</span>
          <div class="site-filter-btns">
            <van-button size="small" plain @click="siteFilter = []">清空</van-button>
            <van-button size="small" type="primary" @click="showSiteFilter = false">确定</van-button>
          </div>
        </div>
        <div class="site-filter-list">
          <van-checkbox-group v-model="siteFilter">
            <van-cell
              v-for="s in uniqueSites"
              :key="s"
              clickable
              :title="s"
              @click="toggleSite(s)"
            >
              <template #right-icon>
                <van-checkbox :name="s" @click.stop />
              </template>
            </van-cell>
          </van-checkbox-group>
          <van-empty v-if="uniqueSites.length === 0" description="暂无站点" image-size="60" />
        </div>
      </div>
    </van-popup>

    <!-- Download Sheet -->
    <van-action-sheet v-model:show="showDownload" title="添加下载" closeable>
      <div class="sheet-content">
        <van-form @submit="submitDownload">
          <van-field
            name="dl_setting"
            label="下载设置"
            :model-value="downloadForm.dl_setting"
            is-link
            readonly
            placeholder="默认"
            @click="showDlSettingPicker = true"
          />
          <van-popup v-model:show="showDlSettingPicker" position="bottom" round>
            <van-picker
              :columns="[{ text: '默认', value: '' }, ...downloadSettings.map(d => ({ text: d.name, value: d.id }))]"
              @confirm="({ selectedOptions }) => { downloadForm.dl_setting = selectedOptions[0].value; onDownloadSettingChange(selectedOptions[0].value); showDlSettingPicker = false }"
              @cancel="showDlSettingPicker = false"
            />
          </van-popup>

          <van-field
            name="dl_dir"
            label="保存目录"
            :model-value="downloadForm.dl_dir"
            is-link
            readonly
            placeholder="自动"
            @click="showDirPicker = true"
          />
          <van-popup v-model:show="showDirPicker" position="bottom" round>
            <van-picker
              :columns="[{ text: '自动', value: '' }, ...savePaths.map(p => ({ text: p, value: p }))]"
              @confirm="({ selectedOptions }) => { downloadForm.dl_dir = selectedOptions[0].value; showDirPicker = false }"
              @cancel="showDirPicker = false"
            />
          </van-popup>

          <div class="sheet-submit">
            <van-button block round type="primary" native-type="submit" :loading="submitting">
              下载
            </van-button>
          </div>
        </van-form>
      </div>
    </van-action-sheet>

    <AddRssMediaDialog
      v-model="showRss"
      :initial-name="rssTask?.keyword"
      :initial-keyword="rssTask?.keyword"
    />

    <!-- Advanced Search Sheet -->
    <van-action-sheet v-model:show="showAdvanced" title="高级搜索" closeable>
      <div class="sheet-content">
        <van-form @submit="doAdvancedSearch">
          <van-field
            v-model="advancedForm.name"
            label="名称"
            placeholder="电影/电视剧名称"
            :rules="[{ required: true, message: '请输入名称' }]"
          />
          <van-field name="type" label="类型">
            <template #input>
              <van-radio-group v-model="advancedForm.type" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio name="电影" shape="square">电影</van-radio>
                <van-radio name="电视剧" shape="square">电视剧</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field v-model="advancedForm.year" label="年份" placeholder="20xx" />
          <van-field name="season" label="季">
            <template #input>
              <van-radio-group v-model="advancedForm.season" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="opt in seasonOptions" v-show="opt.value" :key="opt.value" :name="opt.value" shape="square">
                  {{ opt.label }}
                </van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="restype" label="质量">
            <template #input>
              <van-radio-group v-model="advancedForm.restype" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="(l, k) in restypeDict" :key="k" :name="k" shape="square">{{ l }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="pix" label="分辨率">
            <template #input>
              <van-radio-group v-model="advancedForm.pix" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="(l, k) in pixDict" :key="k" :name="k" shape="square">{{ l }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="sp_state" label="促销">
            <template #input>
              <van-radio-group v-model="advancedForm.sp_state" direction="horizontal">
                <van-radio v-for="s in spStates" :key="s.value" :name="s.value" shape="square">{{ s.label }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="rule" label="规则">
            <template #input>
              <van-radio-group v-model="advancedForm.rule" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="r in filterRules" :key="r.id" :name="String(r.id)" shape="square">{{ r.name }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <div class="sheet-submit">
            <van-button block round type="primary" native-type="submit">开始搜索</van-button>
          </div>
        </van-form>
      </div>
    </van-action-sheet>
  </div>
</template>

<style scoped>
.search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.search-bar {
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  color: #969799;
  flex-shrink: 0;
}

.task-count {
  font-size: 12px;
}

.empty-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-card:active {
  background: #f7f8fa;
}

.task-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-keyword {
  font-weight: 600;
  font-size: 14px;
  color: #323233;
}

.task-status {
  font-size: 11px;
  font-weight: 500;
}

.task-times {
  font-size: 11px;
  color: #969799;
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-arrow {
  color: #c8c9cc;
}

.task-msg {
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
}

.task-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  padding-top: 4px;
}

/* ========== Results Popup ========== */
.results-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.popup-header {
  flex-shrink: 0;
  height: 46px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px 0 4px;
  border-bottom: 1px solid #ebedf0;
  background: #fff;
}

.popup-back {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #323233;
  cursor: pointer;
  flex-shrink: 0;
}

.popup-back:active {
  opacity: 0.6;
}

.popup-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popup-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #969799;
  padding-right: 4px;
}

.loading-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #969799;
}

.results-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}

/* TMDB 信息面板 */
.tmdb-panel {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 10px;
  margin: 12px 12px 0;
  flex-shrink: 0;
}

.tmdb-poster {
  width: 72px;
  height: 102px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.tmdb-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tmdb-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.tmdb-year {
  font-size: 13px;
  color: #969799;
  font-weight: 400;
}

.tmdb-overview {
  font-size: 12px;
  line-height: 1.5;
  color: #969799;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.filter-bar :deep(.filter-input) {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  background: #f7f8fa;
  border-radius: 6px;
}

.filter-site-btn {
  flex-shrink: 0;
}

/* 结果表格 */
.results-table {
  width: 100%;
}

.site-cell {
  display: block;
  font-weight: 600;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-name {
  font-size: 13px;
  font-weight: 500;
  color: #323233;
  line-height: 1.4;
  word-break: break-all;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cell-badges {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  margin-top: 4px;
  overflow: hidden;
}

.seeders-cell {
  color: #07c160;
  font-weight: 500;
}

.cell-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.action-link {
  font-size: 16px;
  color: var(--van-primary-color);
  cursor: pointer;
}

/* 站点筛选弹层 */
.site-filter {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
}

.site-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #ebedf0;
  flex-shrink: 0;
}

.site-filter-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.site-filter-btns {
  display: flex;
  gap: 8px;
}

.site-filter-list {
  flex: 1;
  overflow-y: auto;
}

/* Sheets */
.sheet-content {
  padding: 8px 16px 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.sheet-submit {
  padding: 16px;
}

/* ========== 横屏：左右布局 ========== */
@media (orientation: landscape) and (min-width: 600px) {
  .results-body {
    flex-direction: row;
    padding: 12px;
    gap: 12px;
  }
  .tmdb-panel {
    width: 220px;
    flex-direction: column;
    margin: 0;
    overflow-y: auto;
    align-self: stretch;
  }
  .tmdb-poster {
    width: 100%;
    height: auto;
    max-height: 42vh;
    object-fit: cover;
  }
  .tmdb-overview {
    -webkit-line-clamp: unset;
    overflow: visible;
  }
  .results-main {
    padding: 0;
  }
}

/* 横屏低高度（手机横屏）：收窄左侧面板 */
@media (orientation: landscape) and (max-height: 500px) {
  .tmdb-panel {
    width: 170px;
  }
}

/* 横屏高分辨率（平板/桌面）：加宽左侧面板 */
@media (orientation: landscape) and (min-width: 960px) {
  .tmdb-panel {
    width: 300px;
  }
}

/* 竖屏平板 */
@media (orientation: portrait) and (min-width: 768px) {
  .tmdb-poster {
    width: 90px;
    height: 128px;
  }
  .tmdb-title {
    font-size: 16px;
  }
}
</style>
