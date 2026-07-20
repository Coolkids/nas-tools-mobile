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
  encode: string; releaseGroup: string
}

function flattenSeason(item: SearchResultItem): Array<{ season: string; torrents: FlatTorrent[] }> {
  return item.torrent_dict.map(([seKey, seasonDict]) => {
    const torrents: FlatTorrent[] = []
    for (const [, group] of Object.entries(seasonDict)) {
      for (const [, unique] of Object.entries(group.group_torrents)) {
        for (const t of unique.torrent_list) {
          torrents.push({
            ...t,
            groupRestype: group.group_info.restype,
            groupRespix: group.group_info.respix,
            season: seKey,
            encode: unique.unique_info.video_encode,
            releaseGroup: unique.unique_info.releasegroup
          })
        }
      }
    }
    return { season: seKey, torrents }
  })
}

function freeText(t: TorrentItem): { text: string; type: string } | null {
  if (t.downloadvalue === 0) return { text: 'FREE', type: 'success' }
  if (t.downloadvalue !== 1) return { text: `${Math.round(t.downloadvalue * 100)}%DL`, type: 'primary' }
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
    <div class="search-bar">
      <van-search
        v-model="keyword"
        shape="round"
        placeholder="搜索电影、电视剧资源..."
        show-action
        @search="doSearch"
        @cancel="$router.push('/index')"
      >
        <template #action>
          <div class="adv-link" @click="showAdvanced = true">高级</div>
        </template>
      </van-search>
    </div>

    <div v-if="searching && !hasResults" class="loading-tip">
      <van-loading size="16" /> 正在搜索资源...
    </div>

    <van-empty v-else-if="!hasResults && !searching" description="输入想看的电影、电视剧名称，点击搜索试试看吧。" />

    <template v-else>
      <div class="result-summary">
        <span>共 {{ total }} 个结果</span>
        <span v-if="searching" class="summary-loading"><van-loading size="12" /> 搜索中...</span>
      </div>

      <div class="result-list">
        <div v-for="item in resultItems" :key="item.key" class="result-card">
          <div class="result-head">
            <div class="poster-wrap">
              <img v-if="item.poster" :src="item.poster" class="result-poster"
                @error="($event.target as HTMLImageElement).style.display = 'none'" />
              <van-icon v-else name="tv-o" class="poster-placeholder" />
            </div>
            <div class="result-info">
              <div class="result-title-row">
                <h3 class="result-title">{{ item.title }}</h3>
                <van-tag v-if="item.exist" type="success" round>已存在</van-tag>
              </div>
              <div class="result-meta">
                <van-tag v-if="item.type" size="small" plain type="primary">{{ item.type }}</van-tag>
                <span v-if="item.year" class="meta-item">{{ item.year }}</span>
                <span v-if="item.vote && item.vote !== '0'" class="meta-item meta-vote">
                  <van-icon name="star" />{{ item.vote }}
                </span>
              </div>
              <p v-if="item.overview" class="result-overview">{{ item.overview }}</p>
            </div>
          </div>

          <div class="torrent-section">
            <template v-for="sec in flattenSeason(item)" :key="`${item.key}-${sec.season}`">
              <div v-if="sec.season !== 'MOV'" class="season-title">
                <span>{{ sec.season }}</span>
                <span class="season-count">{{ sec.torrents.length }} 个资源</span>
              </div>
              <div class="torrent-list">
                <div v-for="t in sec.torrents" :key="t.id" class="torrent-item" @click="openDownload(t)">
                  <div class="torrent-main">
                    <div class="torrent-name">{{ t.torrent_name }}</div>
                    <div class="torrent-meta">
                      <span v-if="t.site" class="meta-site">{{ t.site }}</span>
                      <span v-if="t.releaseGroup" class="meta-group">{{ t.releaseGroup }}</span>
                      <span v-if="t.size">{{ t.size }}</span>
                      <span class="meta-seed"><van-icon name="arrow-up" />{{ t.seeders || 0 }}</span>
                    </div>
                    <div class="torrent-badges">
                      <van-tag v-if="t.groupRestype" size="small" plain type="danger">{{ t.groupRestype }}</van-tag>
                      <van-tag v-if="t.groupRespix" size="small" plain type="warning">{{ t.groupRespix }}</van-tag>
                      <van-tag v-if="t.encode" size="small" plain type="primary">{{ t.encode }}</van-tag>
                      <van-tag v-if="freeText(t)" size="small" :type="(freeText(t)!.type as any)">{{ freeText(t)!.text }}</van-tag>
                      <van-tag v-if="uploadText(t)" size="small" type="warning">{{ uploadText(t)!.text }}</van-tag>
                    </div>
                  </div>
                  <div class="torrent-action">
                    <van-icon name="down" />
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <van-action-sheet v-model:show="showAdvanced" title="高级搜索">
      <div class="adv-content">
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
          <div class="adv-submit">
            <van-button block round type="primary" native-type="submit">开始搜索</van-button>
          </div>
        </van-form>
      </div>
    </van-action-sheet>
  </div>
</template>

<style scoped>
/* ========== 搜索栏（吸顶） ========== */
.search-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(247, 248, 250, 0.92);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.search-bar :deep(.van-search) {
  background: transparent;
  padding: 8px 12px;
}
.adv-link {
  color: var(--van-primary-color);
  font-size: 14px;
}

/* ========== 结果统计 ========== */
.result-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  color: #969799;
}
.summary-loading {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--van-primary-color);
}

/* ========== 结果网格：手机1列 / 手机横屏·平板2列 / 大屏3列 ========== */
.result-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: 12px;
  padding: 0 12px 12px;
  align-items: start;
}

.result-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* ========== 卡片头部 ========== */
.result-head {
  display: flex;
  gap: 12px;
  padding: 12px;
}
.poster-wrap {
  flex-shrink: 0;
  width: 72px;
  height: 102px;
  border-radius: 6px;
  overflow: hidden;
  background: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}
.result-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.poster-placeholder {
  font-size: 26px;
  color: #c8c9cc;
}
.result-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.result-title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.result-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: #323233;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.result-title-row .van-tag {
  flex-shrink: 0;
}
.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #969799;
}
.meta-vote {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #ff976a;
  font-weight: 500;
}
.result-overview {
  margin: 0;
  font-size: 12px;
  color: #969799;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ========== 季/资源区 ========== */
.torrent-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
}
.season-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #646566;
  background: #f7f8fa;
  border-left: 3px solid var(--van-primary-color);
  border-radius: 4px;
}
.season-count {
  font-weight: 400;
  color: #969799;
}
.torrent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ========== 种子条目 ========== */
.torrent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.torrent-item:active {
  background: #e8f0fd;
}
.torrent-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.torrent-name {
  font-size: 13px;
  font-weight: 500;
  color: #323233;
  line-height: 1.4;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.torrent-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 11px;
  color: #969799;
}
.meta-site {
  color: var(--van-primary-color);
  font-weight: 500;
}
.meta-group {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-seed {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: #07c160;
  font-weight: 500;
}
.meta-seed .van-icon {
  font-size: 11px;
}
.torrent-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.torrent-action {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(25, 137, 250, 0.1);
  color: var(--van-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

/* ========== 高级搜索 ========== */
.adv-content {
  padding: 8px 16px 24px;
  max-width: 640px;
  margin: 0 auto;
}
.adv-submit {
  padding: 16px;
}

/* ========== 平板及以上 ========== */
@media (min-width: 768px) {
  .result-list {
    gap: 14px;
    padding: 0 16px 16px;
  }
  .result-summary {
    padding: 10px 20px;
    font-size: 13px;
  }
  .poster-wrap {
    width: 82px;
    height: 116px;
  }
  .result-title {
    font-size: 16px;
  }
  .result-head {
    padding: 14px;
  }
  .torrent-section {
    padding: 0 14px 14px;
  }
}
</style>
