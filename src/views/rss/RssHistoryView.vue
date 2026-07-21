<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { getRssHistory, deleteRssHistory, type RssHistoryItem, type RssType } from '@/api/rss'
import { proxyDoubanImage } from '@/api/discovery'
import AddRssMediaDialog from '@/components/AddRssMediaDialog.vue'

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)
const items = ref<RssHistoryItem[]>([])
const activeType = ref<string>('')
const page = ref(1)
const total = ref(0)
const hasMore = ref(true)
const showReRss = ref(false)
const reRssItem = ref<RssHistoryItem | null>(null)

const tabs = [
  { label: '全部', value: '' },
  { label: '电影', value: 'MOV' },
  { label: '电视剧', value: 'TV' },
]

onMounted(() => load(1))

async function load(p: number) {
  page.value = p
  loading.value = true
  try {
    const res = await getRssHistory((activeType.value || undefined) as RssType | undefined, page.value)
    if (res.code === 0) {
      const list = res.result || []
      if (page.value === 1) items.value = list
      else items.value = items.value.concat(list)
      total.value = res.total || 0
      hasMore.value = list.length > 0
    }
  } catch { showToast('加载失败') } finally { loading.value = false }
}

async function onRefresh() {
  refreshing.value = true
  await load(1)
  refreshing.value = false
}

async function onLoadMore() {
  if (loading.value || !hasMore.value) return
  await load(page.value + 1)
}

function onTypeChange(t: string) {
  activeType.value = t
  items.value = []
  hasMore.value = true
  load(1)
}

async function onDelete(item: RssHistoryItem) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.NAME}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteRssHistory(item.ID)
    if (res.code === 0) { showToast('删除成功'); load(1) }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

function onReRss(item: RssHistoryItem) {
  reRssItem.value = item
  showReRss.value = true
}

function onReRssSuccess() {
  showReRss.value = false
  load(1)
}

function goDetail(item: RssHistoryItem) {
  if (item.TMDBID) {
    router.push({ path: '/media_detail', query: { type: item.TYPE === 'MOV' ? 'MOV' : 'TV', id: String(item.TMDBID) } })
  }
}
</script>

<template>
  <div class="rss-history page">
    <van-tabs v-model:active="activeType" @change="onTypeChange">
      <van-tab v-for="tab in tabs" :key="tab.value" :name="tab.value" :title="tab.label" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-loading v-if="loading && items.length === 0" size="20" style="padding:40px;text-align:center" />

      <van-empty v-else-if="items.length === 0" description="暂无订阅历史" />

      <div v-else class="history-list">
        <div v-for="item in items" :key="item.ID" class="history-card" @click="goDetail(item)">
          <img
            v-if="item.IMAGE"
            :src="proxyDoubanImage(item.IMAGE)"
            class="card-poster"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <div v-else class="card-poster poster-placeholder">
            <van-icon name="photo-o" size="24" color="#c8c9cc" />
          </div>
          <div class="card-body">
            <div class="card-title">{{ item.NAME }}</div>
            <div class="card-meta">
              <van-tag :type="item.TYPE === 'MOV' ? 'primary' : 'success'" size="small">
                {{ item.TYPE === 'MOV' ? '电影' : '电视剧' }}
              </van-tag>
              <span v-if="item.YEAR" class="meta-text">{{ item.YEAR }}</span>
              <span v-if="item.TOTAL" class="meta-text">共 {{ item.TOTAL }} 集</span>
            </div>
            <div v-if="item.DESC" class="card-desc">{{ item.DESC }}</div>
            <div class="card-footer">
              <span v-if="item.FINISH_TIME" class="finish-time">{{ item.FINISH_TIME }}</span>
              <span v-if="item.NOTE" class="note-text">{{ item.NOTE }}</span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <van-button size="small" type="primary" class="re-rss-btn" @click="onReRss(item)">重新订阅</van-button>
            <van-icon name="delete" class="delete-icon" @click="onDelete(item)" />
          </div>
        </div>
        <div v-if="hasMore" class="load-more" @click="onLoadMore">
          <van-loading v-if="loading" size="14" />
          <span v-else>点击加载更多</span>
        </div>
      </div>
    </van-pull-refresh>

    <AddRssMediaDialog
      v-model="showReRss"
      :type="(reRssItem?.TYPE as 'MOV' | 'TV')"
      :initial-name="reRssItem?.NAME"
      :initial-year="reRssItem?.YEAR"
      :initial-keyword="reRssItem?.NAME"
      @success="onReRssSuccess"
      @error="showToast($event)"
    />
  </div>
</template>

<style scoped>
.history-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  cursor: pointer;
}
.card-poster {
  width: 64px;
  height: 90px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.poster-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}
.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.meta-text {
  font-size: 12px;
  color: #969799;
}
.card-desc {
  font-size: 12px;
  color: #646566;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}
.finish-time {
  font-size: 11px;
  color: #969799;
}
.note-text {
  font-size: 11px;
  color: #ee0a24;
}
.card-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  justify-content: center;
}
.re-rss-btn {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.delete-icon {
  font-size: 18px;
  color: #ee0a24;
  cursor: pointer;
  padding: 4px;
}
.load-more {
  text-align: center;
  padding: 12px;
  font-size: 13px;
  color: #969799;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
</style>
