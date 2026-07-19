<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { useRouter } from 'vue-router'
import { getMovieRssList, getTvRssList, removeRssMedia, type RssMediaItem } from '@/api/rss'
import { useModalStore } from '@/stores/modal'
import RssMediaDetailDialog from '@/components/RssMediaDetailDialog.vue'
import AddRssMediaDialog from '@/components/AddRssMediaDialog.vue'

const router = useRouter()
const modal = useModalStore()
const loading = ref(false)
const items = ref<RssMediaItem[]>([])
const showAdd = ref(false)
const detailItem = ref<RssMediaItem | null>(null)
const showDetail = ref(false)
const activeTab = ref<'MOV' | 'TV'>('MOV')

onMounted(() => load(activeTab.value))

async function load(type: 'MOV' | 'TV') {
  loading.value = true
  items.value = []
  try {
    const res = type === 'MOV' ? await getMovieRssList() : await getTvRssList()
    if (res.code === 0) items.value = Object.values(res.result || {})
    else showToast(res.msg || '获取订阅列表失败')
  } catch { showToast('获取订阅列表失败') }
  finally { loading.value = false }
}

function onTabChange(tab: 'MOV' | 'TV') {
  activeTab.value = tab
  load(tab)
}

function stateMeta(state?: string) {
  switch (state) {
    case 'D': return { label: '队列中', type: 'info' as const }
    case 'S': return { label: '正在搜索', type: 'warning' as const }
    case 'R': return { label: '正在订阅', type: 'success' as const }
    default: return { label: '完成', type: 'primary' as const }
  }
}

function progressOf(item: RssMediaItem) {
  const total = item.total || 0
  if (total <= 0) return 0
  return Math.round(((total - (item.lack || 0)) * 100) / total)
}

function onCardClick(item: RssMediaItem) {
  detailItem.value = item
  showDetail.value = true
}
</script>

<template>
  <div class="rss-index page">
    <van-sticky>
      <van-tabs v-model:active="activeTab" @change="onTabChange" sticky>
        <van-tab name="MOV" title="电影" />
        <van-tab name="TV" title="电视剧" />
      </van-tabs>
    </van-sticky>

    <div style="padding: 8px 12px">
      <van-button  block type="primary" icon="plus" @click="showAdd = true">新增订阅</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="items.length === 0" :description="activeTab === 'MOV' ? '当前没有正在订阅的电影。' : '当前没有正在订阅的电视剧。'" />

    <div v-else class="card-list">
      <div v-for="item in items" :key="item.id" class="rss-card" @click="onCardClick(item)">
        <div class="card-bg">
          <img :src="item.image" class="bg-img" />
          <div class="card-overlay" />
          <div class="card-content">
            <img :src="item.poster || item.image" class="card-poster" />
            <div class="card-info">
              <div class="info-top">
                <span v-if="item.year" class="info-year">{{ item.year }}</span>
                <van-tag size="small" :type="stateMeta(item.state).type">{{ stateMeta(item.state).label }}</van-tag>
                <van-tag v-if="item.over_edition" size="small" type="danger">洗版</van-tag>
              </div>
              <div class="info-name">
                {{ item.name }}
                <span v-if="item.season && item.season !== 'S00'" class="info-season">{{ item.season }}</span>
              </div>
              <div v-if="activeTab === 'TV'" class="info-meta">
                <span v-if="item.total_ep || item.total" class="meta-ep">
                  {{ item.current_ep || (item.total ? item.total - (item.lack || 0) : '?') }}/{{ item.total_ep || item.total }} 集
                </span>
                <span v-if="item.filter_team" class="meta-team">{{ item.filter_team }}</span>
              </div>
              <div v-if="activeTab === 'TV' && item.total && item.total > 0" class="info-progress">
                <van-progress :percentage="progressOf(item)" :stroke-width="4" :show-pivot="false" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AddRssMediaDialog v-model="showAdd" :type="activeTab" @success="showAdd = false; load(activeTab)" @error="showToast($event)" />
    <RssMediaDetailDialog v-model="showDetail" :item="detailItem" :type="activeTab" @removed="showDetail = false; load(activeTab)" />
  </div>
</template>

<style scoped>
.card-list { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.rss-card { border-radius: 8px; overflow: hidden; }
.card-bg { position: relative; height: 160px; overflow: hidden; display: flex; }
.bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.card-overlay { position: absolute; inset: 0; backg: rgba(0,0,0,0.5); backdrop-filter: blur(6px); z-index: 1; }
.card-content { position: relative; z-index: 2; flex: 1; padding: 12px; display: flex; gap: 12px; }
.card-poster { width: 80px; height: 110px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); flex-shrink: 0; object-fit: cover; }
.card-info { flex: 1; display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
.info-top { display: flex; gap: 4px; flex-wrap: wrap; }
.info-year { font-size: 14px; color: rgba(255,255,255,0.8); }
.info-name { font-size: 16px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info-season { font-size: 13px; color: rgba(255,255,255,0.7); }
.info-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.7); }
.meta-team { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info-progress { margin-top: 4px; }
</style>
