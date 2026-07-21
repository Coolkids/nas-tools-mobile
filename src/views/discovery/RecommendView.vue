<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useScrollParent } from '@vant/use'
import MediaCard from '@/components/MediaCard.vue'
import { getRecommend, proxyDoubanImage, type RecommendItem } from '@/api/discovery'

const route = useRoute()
const router = useRouter()

const root = ref<HTMLElement>()
const scrollParent = useScrollParent(root)

interface FilterSet {
  name: string
  options: Array<{ label: string; value: string }>
}

const CATEGORIES = [
  { name: 'recommend', label: '推荐' },
  { name: 'douban_movie', label: '豆瓣电影' },
  { name: 'douban_tv', label: '豆瓣剧集' },
  { name: 'tmdb_movie', label: 'TMDB电影' },
  { name: 'tmdb_tv', label: 'TMDB剧集' },
  { name: 'ranking', label: '榜单' },
]

const activeCategory = ref('recommend')
const page = ref(1)
const items = ref<RecommendItem[]>([])
const loading = ref(false)
const noMore = ref(false)
const initializing = ref(false)
const refreshing = ref(false)
const filterParams = ref<Record<string, string>>({})
const activeFilterKey = ref('')
const showFilterSheet = ref(false)
let fetchGen = 0

function initFromRoute() {
  const name = route.name as string
  const cat = CATEGORIES.find(c => c.name === name)
  if (cat && cat.name !== activeCategory.value) {
    activeCategory.value = cat.name
  }
}

function switchCategory(name: string) {
  activeCategory.value = name
  filterParams.value = {}
  if (name === 'ranking') {
    loadRankings()
    return
  }
  reset()
}

function tabConfig(): { type: string; subtype?: string; params?: Record<string, string> } {
  const cat = activeCategory.value
  const fp = filterParams.value
  const hasFp = Object.keys(fp).length > 0
  switch (cat) {
    case 'recommend': return { type: 'TRENDING', params: hasFp ? fp : undefined }
    case 'douban_movie': return { type: 'DOUBANTAG', subtype: 'MOV', params: hasFp ? fp : undefined }
    case 'douban_tv': return { type: 'DOUBANTAG', subtype: 'TV', params: hasFp ? fp : undefined }
    case 'tmdb_movie': return { type: 'DISCOVER', subtype: 'MOV', params: hasFp ? fp : undefined }
    case 'tmdb_tv': return { type: 'DISCOVER', subtype: 'TV', params: hasFp ? fp : undefined }
    default: return { type: 'TRENDING' }
  }
}

const isFilterable = computed(() =>
  ['douban_movie', 'douban_tv', 'tmdb_movie', 'tmdb_tv'].includes(activeCategory.value)
)

const isRanking = computed(() => activeCategory.value === 'ranking')

const filterSets = computed<Record<string, FilterSet>>(() => {
  const cat = activeCategory.value
  if (cat === 'douban_movie') {
    return {
      sort: {
        name: '排序',
        options: [
          { label: '默认', value: '' },
          { label: '综合排序', value: 'U' },
          { label: '首播时间', value: 'T' },
          { label: '高分优先', value: 'S' },
          { label: '近期热度', value: 'R' },
        ]
      },
      tags: {
        name: '类型',
        options: [
          { label: '全部', value: '' },
          { label: '喜剧', value: '喜剧' }, { label: '爱情', value: '爱情' },
          { label: '动作', value: '动作' }, { label: '科幻', value: '科幻' },
          { label: '动画', value: '动画' }, { label: '悬疑', value: '悬疑' },
          { label: '犯罪', value: '犯罪' }, { label: '惊悚', value: '惊悚' },
          { label: '冒险', value: '冒险' }, { label: '奇幻', value: '奇幻' },
          { label: '恐怖', value: '恐怖' }, { label: '战争', value: '战争' },
          { label: '武侠', value: '武侠' }, { label: '灾难', value: '灾难' },
        ]
      }
    }
  }
  if (cat === 'douban_tv') {
    return {
      sort: {
        name: '排序',
        options: [
          { label: '默认', value: '' },
          { label: '综合排序', value: 'U' },
          { label: '首播时间', value: 'T' },
          { label: '高分优先', value: 'S' },
          { label: '近期热度', value: 'R' },
        ]
      },
      tags: {
        name: '地区',
        options: [
          { label: '全部', value: '' },
          { label: '华语', value: '华语' }, { label: '中国大陆', value: '中国大陆' },
          { label: '中国香港', value: '中国香港' }, { label: '中国台湾', value: '中国台湾' },
          { label: '欧美', value: '欧美' }, { label: '韩国', value: '韩国' },
          { label: '日本', value: '日本' }, { label: '印度', value: '印度' },
          { label: '泰国', value: '泰国' },
        ]
      }
    }
  }
  if (cat === 'tmdb_movie') {
    return {
      with_genres: {
        name: '类型',
        options: [
          { label: '全部', value: '' },
          { label: '冒险', value: '12' }, { label: '动画', value: '16' },
          { label: '喜剧', value: '35' }, { label: '犯罪', value: '80' },
          { label: '剧情', value: '18' }, { label: '奇幻', value: '14' },
          { label: '恐怖', value: '27' }, { label: '悬疑', value: '9648' },
          { label: '爱情', value: '10749' }, { label: '科幻', value: '878' },
          { label: '惊悚', value: '53' }, { label: '战争', value: '10752' },
        ]
      },
      with_original_language: {
        name: '语言',
        options: [
          { label: '全部', value: '' },
          { label: '中文', value: 'zh' }, { label: '英语', value: 'en' },
          { label: '日语', value: 'ja' }, { label: '韩语', value: 'ko' },
          { label: '法语', value: 'fr' }, { label: '德语', value: 'de' },
          { label: '俄语', value: 'ru' }, { label: '印地语', value: 'hi' },
        ]
      }
    }
  }
  if (cat === 'tmdb_tv') {
    return {
      with_genres: {
        name: '类型',
        options: [
          { label: '全部', value: '' },
          { label: '动作冒险', value: '10759' }, { label: '动画', value: '16' },
          { label: '喜剧', value: '35' }, { label: '犯罪', value: '80' },
          { label: '纪录', value: '99' }, { label: '剧情', value: '18' },
          { label: '儿童', value: '10762' }, { label: '悬疑', value: '9648' },
          { label: '真人秀', value: '10764' }, { label: '科幻', value: '10765' },
        ]
      },
      with_original_language: {
        name: '语言',
        options: [
          { label: '全部', value: '' },
          { label: '中文', value: 'zh' }, { label: '英语', value: 'en' },
          { label: '日语', value: 'ja' }, { label: '韩语', value: 'ko' },
          { label: '法语', value: 'fr' }, { label: '德语', value: 'de' },
          { label: '俄语', value: 'ru' }, { label: '印地语', value: 'hi' },
        ]
      }
    }
  }
  return {}
})

async function loadPage() {
  if (loading.value || noMore.value) return
  loading.value = true
  const gen = ++fetchGen
  try {
    const cfg = tabConfig()
    const params: Record<string, unknown> = { type: cfg.type, page: page.value }
    if (cfg.subtype) params.subtype = cfg.subtype
    if (cfg.params) params.params = cfg.params

    const res = await getRecommend(params as any)
    if (gen !== fetchGen) return
    if (res.code === 0) {
      const list = res.Items || []
      if (list.length === 0) noMore.value = true
      else { items.value.push(...list); page.value += 1 }
    } else { showToast(res.msg || '加载失败'); noMore.value = true }
  } catch { if (fetchGen === gen) { showToast('加载失败'); noMore.value = true } }
  finally {
    if (gen === fetchGen) {
      loading.value = false
      // 内容不足以撑满滚动区域时继续加载下一页
      nextTick(() => onScroll())
    }
  }
}

async function reset() {
  fetchGen++
  items.value = []
  page.value = 1
  noMore.value = false
  initializing.value = true
  await loadPage()
  initializing.value = false
}

async function onRefresh() {
  refreshing.value = true
  if (isRanking.value) await loadRankings()
  else await reset()
  refreshing.value = false
}

function distanceToBottom() {
  const sp = scrollParent.value
  if (sp && sp !== window) {
    const el = sp as HTMLElement
    return el.scrollHeight - el.clientHeight - el.scrollTop
  }
  const el = document.documentElement
  return el.scrollHeight - el.clientHeight - el.scrollTop
}

function onScroll() {
  if (loading.value || noMore.value || isRanking.value) return
  if (distanceToBottom() < 300) loadPage()
}

function onFavChange(idx: number, fav: string) {
  if (items.value[idx]) items.value[idx].fav = fav
}

function currentFilterLabel(key: string, fs: FilterSet): string {
  const v = filterParams.value[key]
  if (!v) return '不限'
  return fs.options.find(o => o.value === v)?.label || '不限'
}

function openFilter(key: string) {
  activeFilterKey.value = key
  showFilterSheet.value = true
}

function onFilterSelect(value: string) {
  showFilterSheet.value = false
  const key = activeFilterKey.value
  filterParams.value = { ...filterParams.value, [key]: value }
  reset()
}

function clearFilter(key: string, e: Event) {
  e.stopPropagation()
  const updated = { ...filterParams.value }
  delete updated[key]
  filterParams.value = updated
  reset()
}

const activeFilterOptions = computed(() => {
  const fs = filterSets.value[activeFilterKey.value]
  if (!fs) return []
  return fs.options
})

const activeFilterLabel = computed(() => {
  const fs = filterSets.value[activeFilterKey.value]
  if (!fs) return ''
  return currentFilterLabel(activeFilterKey.value, fs)
})

// ---- 榜单数据 ----
interface RankingSection {
  title: string
  route: string
  items: RecommendItem[]
  loaded: boolean
}

const weekDayNames: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' }
const todayWeek = (new Date().getDay() || 7)

const rankingSections = ref<RankingSection[]>([
  { title: 'TMDB热门', route: 'tmdb_movie', items: [], loaded: false },
  { title: '豆瓣热门电影', route: 'douban_movie', items: [], loaded: false },
  { title: '豆瓣热门剧集', route: 'douban_tv', items: [], loaded: false },
])

async function loadRankings() {
  rankingSections.value.forEach(s => { s.items = []; s.loaded = false })
  for (const s of rankingSections.value) {
    try {
      const params: Record<string, unknown> = { type: 'TRENDING', page: 1 }
      if (s.route.startsWith('douban')) {
        params.type = 'DOUBANTAG'
        params.subtype = s.route === 'douban_movie' ? 'MOV' : 'TV'
      }
      const res = await getRecommend(params as any)
      if (res.code === 0) {
        s.items = (res.Items || []).slice(0, 10)
        s.loaded = true
      }
    } catch { /* skip */ }
  }
  await loadBangumiToday()
}

const bangumiToday = ref<RecommendItem[]>([])
const bangumiLoading = ref(false)

async function loadBangumiToday() {
  bangumiLoading.value = true
  try {
    const res = await getRecommend({ type: 'TV', subtype: 'bangumi', page: 1, week: String(todayWeek) })
    if (res.code === 0) bangumiToday.value = (res.Items || []).slice(0, 10)
  } catch { /* skip */ }
  finally { bangumiLoading.value = false }
}

function goRoute(name: string) {
  router.push({ name })
}

function goDetail(item: RecommendItem) {
  router.push({
    name: 'media_detail',
    query: { type: item.type || item.media_type || 'movie', tmdbid: item.tmdbid || item.id }
  })
}

onMounted(() => {
  initFromRoute()
  if (isRanking.value) loadRankings()
  else reset()
  scrollParent.value?.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  scrollParent.value?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="recommend-view" ref="root">
    <van-sticky>
      <van-tabs v-model:active="activeCategory" @change="switchCategory" swipeable>
        <van-tab v-for="cat in CATEGORIES" :key="cat.name" :name="cat.name" :title="cat.label" />
      </van-tabs>
    </van-sticky>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="filter-bar" v-if="isFilterable">
        <div class="filter-chips">
          <div
            v-for="(fs, key) in filterSets"
            :key="key"
            class="filter-chip"
            :class="{ active: filterParams[key] }"
            @click="openFilter(key)"
          >
            <span>{{ filterParams[key] ? currentFilterLabel(key, fs) : fs.name }}</span>
            <van-icon v-if="filterParams[key]" name="close" size="12" @click="(e: Event) => clearFilter(key, e)" />
            <van-icon v-else name="arrow-down" size="12" />
          </div>
        </div>
      </div>

      <template v-if="isRanking">
        <div v-for="section in rankingSections" :key="section.title" class="ranking-section">
          <div class="ranking-header" @click="goRoute(section.route)">
            <span class="ranking-title">{{ section.title }}</span>
            <van-icon name="arrow" color="#969799" />
          </div>
          <div v-if="section.loaded && section.items.length" class="ranking-scroll">
            <div v-for="item in section.items" :key="item.id" class="ranking-card" @click="goDetail(item)">
              <img :src="proxyDoubanImage(item.image)" class="ranking-poster" />
              <div class="ranking-name">{{ item.title }}</div>
              <div v-if="item.vote" class="ranking-vote">{{ String(item.vote).replace(/[\[\]]/g, '').trim() }}</div>
            </div>
          </div>
          <div v-else class="ranking-loading"><van-loading size="16" /></div>
        </div>

        <div class="ranking-section">
          <div class="ranking-header" @click="goRoute('bangumi')">
            <span class="ranking-title">Bangumi 每日放送 · {{ weekDayNames[todayWeek] }}</span>
            <div style="display:flex;align-items:center;gap:4px;font-size:13px;color:#969799">
              <span>全部</span><van-icon name="arrow" color="#969799" />
            </div>
          </div>
          <div v-if="bangumiLoading" class="ranking-loading"><van-loading size="16" /></div>
          <div v-else-if="bangumiToday.length" class="ranking-scroll">
            <div v-for="item in bangumiToday" :key="item.id" class="ranking-card" @click="goDetail(item)">
              <img :src="proxyDoubanImage(item.image)" class="ranking-poster" />
              <div class="ranking-name">{{ item.title }}</div>
              <div v-if="item.date" class="ranking-vote" style="color:#969799">{{ item.date }}</div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <van-empty v-if="!initializing && !loading && items.length === 0" description="没有数据" />
        <div v-else class="media-grid" style="padding: 8px">
          <MediaCard
            v-for="(item, idx) in items"
            :key="`${item.id}-${idx}`"
            :tmdb-id="item.id"
            :title="item.title"
            :image="proxyDoubanImage(item.image)"
            :fav="item.fav"
            :vote="item.vote"
            :year="item.year"
            :overview="item.overview"
            :date="item.date"
            :media-type="item.type"
            :res-type="item.media_type"
            :show-sub="'1'"
            :site="item.site"
            :weekday="item.weekday"
            @fav-change="onFavChange(idx, $event)"
          />
        </div>
        <div v-if="loading" class="loading-tip"><van-loading size="16" /> 加载中...</div>
        <div v-else-if="noMore && items.length > 0" class="loading-tip">没有更多了</div>
      </template>
    </van-pull-refresh>

    <van-action-sheet
      v-model:show="showFilterSheet"
      :title="filterSets[activeFilterKey]?.name || ''"
      :actions="activeFilterOptions.map(o => ({ name: o.label, value: o.value }))"
      @select="(a: any) => onFilterSelect(a.value)"
    />
  </div>
</template>

<style scoped>
.recommend-view { padding-bottom: 12px; }

.filter-bar { padding: 8px 12px 4px; }
.filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.filter-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 14px; font-size: 13px;
  background: #f5f5f5; color: #646566; cursor: pointer;
}
.filter-chip.active { background: #e8f4fe; color: #1989fa; }

.ranking-section { margin: 12px; }
.ranking-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; cursor: pointer; }
.ranking-title { font-size: 15px; font-weight: 600; color: #323233; }
.ranking-scroll { display: flex; gap: 10px; overflow-x: auto; padding: 4px 0 8px; -webkit-overflow-scrolling: touch; }
.ranking-card { flex-shrink: 0; width: 100px; cursor: pointer; }
.ranking-poster { width: 100px; height: 140px; object-fit: cover; border-radius: 6px; display: block; }
.ranking-name { font-size: 12px; color: #323233; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ranking-vote { font-size: 11px; color: #fa9a3e; }
.ranking-loading { padding: 20px; text-align: center; }
.loading-tip { text-align: center; padding: 16px; color: #969799; font-size: 13px; }
</style>
