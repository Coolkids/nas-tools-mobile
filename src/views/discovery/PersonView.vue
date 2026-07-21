<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useScrollParent } from '@vant/use'
import MediaCard from '@/components/MediaCard.vue'
import { personMedias, proxyDoubanImage, type RecommendItem } from '@/api/discovery'

const route = useRoute()
const router = useRouter()

const root = ref<HTMLElement>()
const scrollParent = useScrollParent(root)

const personId = computed(() => (route.query.id as string) || (route.query.tmdbid as string) || '')
const personName = computed(() => (route.query.name as string) || (route.query.title as string) || '人物')

const creditType = ref<'MOV' | 'TV'>(
  ((route.query.type as string) || 'MOV').toUpperCase() === 'TV' ? 'TV' : 'MOV'
)

const items = ref<RecommendItem[]>([])
const page = ref(1)
const loading = ref(false)
const noMore = ref(false)
const refreshing = ref(false)

function switchType(t: 'MOV' | 'TV') {
  if (t === creditType.value) return
  router.replace({ path: route.path, query: { ...route.query, type: t } })
}

async function loadPage() {
  if (loading.value || noMore.value || !personId.value) return
  loading.value = true
  try {
    const res = await personMedias(personId.value, creditType.value, page.value)
    if (res.code === 0) {
      const list = res.data || []
      if (list.length === 0) {
        noMore.value = true
      } else {
        items.value.push(...list)
        page.value += 1
        if (list.length < 20) noMore.value = true
      }
    } else {
      showToast(res.msg || '加载失败')
      noMore.value = true
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : '加载失败')
    noMore.value = true
  } finally {
    loading.value = false
    // 内容不足以撑满滚动区域时继续加载下一页
    nextTick(() => onScroll())
  }
}

function reset() {
  items.value = []
  page.value = 1
  noMore.value = false
  return loadPage()
}

async function onRefresh() {
  refreshing.value = true
  await reset()
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
  if (loading.value || noMore.value) return
  if (distanceToBottom() < 200) loadPage()
}

onMounted(() => { reset(); scrollParent.value?.addEventListener('scroll', onScroll, { passive: true }) })
onBeforeUnmount(() => scrollParent.value?.removeEventListener('scroll', onScroll))
watch(personId, () => reset())
watch(creditType, () => reset())
watch(() => route.query.type, (t) => {
  const next = ((t as string) || 'MOV').toUpperCase() === 'TV' ? 'TV' : 'MOV'
  if (next !== creditType.value) creditType.value = next
})
</script>

<template>
  <div class="person-view" ref="root">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="person-header">
        <van-avatar :size="72" class="person-avatar">{{ personName.charAt(0) || '?' }}</van-avatar>
        <div class="person-meta">
          <h2 class="person-name">{{ personName }}</h2>
          <van-radio-group :model-value="creditType" direction="horizontal" @change="switchType">
            <van-radio name="MOV" shape="square">参演电影</van-radio>
            <van-radio name="TV" shape="square">参演剧集</van-radio>
          </van-radio-group>
        </div>
      </div>

      <van-empty v-if="!loading && items.length === 0" description="暂无作品" />

      <div v-else class="media-grid">
        <MediaCard
          v-for="(item, idx) in items" :key="`${item.id}-${idx}`"
          :tmdb-id="item.id" :title="item.title"
          :image="proxyDoubanImage(item.image)" :fav="item.fav"
          :vote="item.vote" :year="item.year"
          :overview="item.overview" :date="item.date"
          :media-type="item.type" :res-type="item.media_type"
          :show-sub="'1'"
        />
      </div>

      <div v-if="loading" class="loading-tip"><van-loading size="16" /> 加载中...</div>
      <div v-else-if="noMore && items.length > 0" class="loading-tip"><span>没有更多了</span></div>
    </van-pull-refresh>
  </div>
</template>

<style scoped>
.person-view { padding: 12px; }
.person-header {
  display: flex; align-items: center; gap: 16px;
  padding: 16px; margin-bottom: 16px;
  background: #f7f8fa; border-radius: 10px;
}
.person-avatar { background: var(--van-primary-color); color: #fff; font-weight: 600; }
.person-meta { display: flex; flex-direction: column; gap: 10px; }
.person-name { margin: 0; font-size: 18px; font-weight: 600; }
.media-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
@media (min-width: 768px) {
  .media-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>
