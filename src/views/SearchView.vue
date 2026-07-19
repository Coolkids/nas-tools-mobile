<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { search, getSearchResult, type SearchResultItem, type TorrentItem, type SearchParams } from '@/api/media'
import { useModalStore } from '@/stores/modal'

const route = useRoute()
const router = useRouter()
const modal = useModalStore()

const keyword = ref((route.query.q as string) || '')
const searching = ref(false)
const results = ref<SearchResultItem[]>([])
const total = ref(0)
const showAdvanced = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollStart = 0
let lastTotal = -1
let stableCount = 0

const advancedForm = reactive({
  type: '', name: '', year: '', season: '',
  restype: '', pix: '', sp_state: '* *', rule: ''
})

const resultItems = computed(() => Object.values(results.value))
const hasResults = computed(() => resultItems.value.length > 0)

interface FlatTorrent extends TorrentItem {
  groupRestype: string; groupRespix: string; season: string
}

function flattenSeason(item: SearchResultItem): Array<{ season: string; torrents: FlatTorrent[] }> {
  return item.torrent_dict.map(([seKey, seasonDict]) => {
    const torrents: FlatTorrent[] = []
    for (const [, group] of Object.entries(seasonDict)) {
      for (const [, unique] of Object.entries(group.group_torrents)) {
        for (const t of unique.torrent_list) {
          torrents.push({ ...t, groupRestype: group.group_info.restype, groupRespix: group.group_info.respix, season: seKey })
        }
      }
    }
    return { season: seKey, torrents }
  })
}

function freeText(t: TorrentItem): { text: string; type: string } | null {
  if (t.downloadvalue === 0) return { text: 'FREE', type: 'success' }
  if (t.downloadvalue !== 1) return { text: `${Math.round(t.downloadvalue * 100)}%DL`, type: 'info' }
  return null
}

function uploadText(t: TorrentItem): { text: string; type: string } | null {
  if (t.uploadvalue !== 1) return { text: `${Math.round(t.uploadvalue * 100)}%UL`, type: 'warning' }
  return null
}

function openPage(url: string) {
  if (url) window.open(url, '_blank')
}

async function fetchResults() {
  try {
    const res = await getSearchResult()
    if (res.code === 0) {
      total.value = res.total || 0
      results.value = Object.values(res.result || {})
      if (total.value === lastTotal) {
        stableCount += 1
      } else {
        stableCount = 0
        lastTotal = total.value
      }
      if (stableCount >= 2 && total.value > 0) stopPolling()
    }
  } catch { /* ignore */ }
  if (Date.now() - pollStart > 30000) stopPolling()
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(fetchResults, 1500)
}

function stopPolling() {
  searching.value = false
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function doSearch(extraFilters?: Record<string, string>, unident?: boolean) {
  const q = keyword.value.trim()
  if (!q) { showToast('请输入搜索关键字'); return }
  stopPolling()
  searching.value = true
  results.value = []
  total.value = 0
  lastTotal = -1
  stableCount = 0
  try {
    const params: SearchParams = { search_word: q }
    if (extraFilters && Object.keys(extraFilters).length > 0) params.filters = extraFilters
    if (unident) params.unident = true
    const res = await search(params)
    if (res.code !== 0 && res.msg) showToast(res.msg)
  } catch (e) {
    showToast(e instanceof Error ? e.message : '搜索请求失败')
  }
  pollStart = Date.now()
  await fetchResults()
  startPolling()
}

async function doAdvancedSearch() {
  const name = advancedForm.name.trim()
  if (!name) { showToast('请输入电影/电视剧名称'); return }
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
  stopPolling()
  searching.value = true
  results.value = []
  total.value = 0
  lastTotal = -1
  stableCount = 0
  try {
    const res = await search({ search_word: kw, filters, unident: true })
    if (res.code !== 0 && res.msg) showToast(res.msg)
  } catch (e) {
    showToast(e instanceof Error ? e.message : '搜索请求失败')
  }
  pollStart = Date.now()
  await fetchResults()
  startPolling()
}

function openDownload(t: TorrentItem) {
  if (!t.id) { showToast('无可用下载链接'); return }
  router.push({ path: '/downloading' })
}

onMounted(() => {
  if (keyword.value) {
    const filtersRaw = route.query.filters as string | undefined
    const unident = route.query.unident === 'true'
    if (filtersRaw) {
      try { const filters = JSON.parse(filtersRaw); doSearch(filters, unident); return } catch { /* */ }
    }
    doSearch()
  }
})
onBeforeUnmount(stopPolling)

const restypeDict: Record<string, string> = { BLURAY: 'BluRay', REMUX: 'REMUX', DOLBY: 'Dolby', WEB: 'WEB-DL', HDTV: 'HDTV', UHD: 'UHD', HDR: 'HDR', '3D': '3D' }
const pixDict: Record<string, string> = { '8k': '8K', '4k': '4K', '1080p': '1080p', '720p': '720p' }
const spStates = [
  { value: '* *', label: '全部' }, { value: '1.0 1.0', label: '普通' },
  { value: '1.0 0.0', label: '免费' }, { value: '2.0 1.0', label: '2X' },
  { value: '2.0 0.0', label: '2X免费' }, { value: '1.0 0.5', label: '50%' },
  { value: '2.0 0.5', label: '2X 50%' }, { value: '1.0 0.7', label: '70%' },
  { value: '1.0 0.3', label: '30%' }
]
</script>

<template>
  <div class="search-view page">
    <van-search
      v-model="keyword"
      placeholder="搜索资源..."
      show-action
      @search="doSearch"
      @cancel="$router.push('/index')"
    >
      <template #action>
        <div @click="showAdvanced = true">高级</div>
      </template>
    </van-search>

    <div v-if="searching && !hasResults" class="loading-tip">
      <van-loading size="16" /> 正在搜索资源...
    </div>

    <van-empty v-else-if="!hasResults && !searching" description="输入想看的电影、电视剧名称，点击搜索试试看吧。" />

    <div v-else class="result-list">
      <div v-for="item in resultItems" :key="item.key" class="result-card">
        <div class="result-head">
          <img v-if="item.poster" :src="item.poster" class="result-poster"
            @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div class="result-info">
            <div class="result-title-row">
              <h3 class="result-title">{{ item.title }}</h3>
              <van-tag v-if="item.exist" type="success">已存在</van-tag>
            </div>
            <div class="result-meta">
              <van-tag v-if="item.type" size="small" plain>{{ item.type }}</van-tag>
              <span v-if="item.vote && item.vote !== '0'" class="meta-text">评分 {{ item.vote }}</span>
            </div>
            <p v-if="item.overview" class="result-overview">{{ item.overview }}</p>
          </div>
        </div>

        <div v-for="sec in flattenSeason(item)" :key="`${item.key}-${sec.season}`" class="season-block">
          <div v-if="sec.season !== 'MOV'" class="season-title">{{ sec.season }}</div>
          <van-cell
            v-for="t in sec.torrents" :key="t.id"
            :title="t.torrent_name"
            :label="`${t.site} | ${t.size} | ${t.seeders || 0}↑`"
            is-link
            @click="openDownload(t)"
          >
            <template #extra>
              <div class="torrent-badges">
                <van-tag v-if="t.groupRestype" size="small" type="danger">{{ t.groupRestype }}</van-tag>
                <van-tag v-if="t.groupRespix" size="small" type="warning">{{ t.groupRespix }}</van-tag>
              </div>
            </template>
          </van-cell>
        </div>
      </div>
    </div>

    <van-action-sheet v-model:show="showAdvanced" title="高级搜索">
      <div style="padding: 16px">
        <van-form @submit="doAdvancedSearch">
          <van-field v-model="advancedForm.name" label="名称" placeholder="电影/电视剧名称" :rules="[{ required: true, message: '请输入名称' }]" />
          <van-field v-model="advancedForm.year" label="年份" placeholder="20xx" />
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
          <div style="padding: 16px">
            <van-button block type="primary" native-type="submit">开始搜索</van-button>
          </div>
        </van-form>
      </div>
    </van-action-sheet>
  </div>
</template>

<style scoped>
.result-list { padding: 0 12px; }
.result-card { margin-bottom: 12px; background: #fff; border-radius: 8px; overflow: hidden; }
.result-head { display: flex; gap: 10px; padding: 10px; }
.result-poster { width: 60px; height: 90px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.result-info { flex: 1; min-width: 0; }
.result-title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.result-title { margin: 0; font-size: 15px; font-weight: 600; }
.result-meta { display: flex; gap: 8px; font-size: 12px; color: #969799; margin-bottom: 4px; }
.meta-text { font-size: 12px; }
.result-overview { margin: 0; font-size: 12px; color: #969799; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.season-title { font-weight: 600; font-size: 13px; padding: 4px 10px; background: #f7f8fa; border-left: 3px solid var(--van-primary-color); }
.torrent-badges { display: flex; gap: 4px; }
</style>
