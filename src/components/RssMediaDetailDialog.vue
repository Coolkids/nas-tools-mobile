<script setup lang="ts">
import { computed } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { removeRssMedia, refreshRss, type RssMediaItem, type RssType } from '@/api/rss'
import { useModalStore } from '@/stores/modal'

const props = defineProps<{
  modelValue: boolean
  item: RssMediaItem | null
  type: RssType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'removed'): void
  (e: 'edit', rssid: string | number): void
  (e: 'searched'): void
  (e: 'refreshed'): void
}>()

const modal = useModalStore()
const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

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

function onEdit() {
  if (!props.item) return
  visible.value = false
  emit('edit', props.item.id)
}

async function onRemove() {
  if (!props.item) return
  const ok = await modal.confirm(`确认删除订阅「${props.item.name}」？`)
  if (!ok) return
  try {
    const res = await removeRssMedia({ name: props.item.name, type: props.type, year: props.item.year, season: props.item.season, rssid: props.item.id, tmdbid: props.item.tmdbid })
    if (res.code === 0) { showToast('取消订阅成功'); visible.value = false; emit('removed') }
    else showToast(res.msg || '取消订阅失败')
  } catch { showToast('取消订阅失败') }
}

async function onSearch() {
  if (!props.item) return
  try {
    const res = await refreshRss(props.item.id, props.type)
    if (res.code === 0) { showToast('已触发搜索'); emit('searched') }
    else showToast(res.msg || '触发搜索失败')
  } catch { showToast('触发搜索失败') }
}

async function onRefresh() {
  if (!props.item) return
  try {
    const res = await refreshRss(props.item.id, props.type)
    if (res.code === 0) { showToast('已触发刷新'); emit('refreshed') }
    else showToast(res.msg || '触发刷新失败')
  } catch { showToast('触发刷新失败') }
}
</script>

<template>
  <van-action-sheet v-model:show="visible" title="订阅详情" class="rss-detail-sheet">
    <div v-if="item" class="sheet-body">
      <div class="media-header">
        <div class="media-poster">
          <img v-if="item.poster || item.image" :src="item.poster || item.image" :alt="item.name" class="poster-img" />
          <div v-else class="poster-placeholder">
            <van-icon name="photo-o" size="28" />
          </div>
        </div>
        <div class="media-info">
          <div class="media-name">{{ item.name }}</div>
          <div v-if="item.year" class="media-year">{{ item.year }}</div>
          <div class="media-tags">
            <van-tag size="small" :type="stateMeta(item.state).type">{{ stateMeta(item.state).label }}</van-tag>
            <van-tag v-if="item.over_edition" size="small" type="danger">洗版</van-tag>
          </div>
        </div>
      </div>

      <div v-if="item.overview" class="media-overview">{{ item.overview }}</div>

      <div v-if="type === 'TV' && item.total && item.total > 0" class="media-progress">
        <div class="progress-label">
          <span>订阅进度</span>
          <span>{{ progressOf(item) }}%</span>
        </div>
        <van-progress :percentage="progressOf(item)" :stroke-width="6" :show-pivot="false" />
      </div>

      <div v-if="item.filter_restype || item.filter_pix || item.filter_team" class="media-filters">
        <van-tag v-if="item.filter_restype" size="small">{{ item.filter_restype }}</van-tag>
        <van-tag v-if="item.filter_pix" size="small">{{ item.filter_pix }}</van-tag>
        <van-tag v-if="item.filter_team" size="small" plain>{{ item.filter_team }}</van-tag>
      </div>
    </div>

    <div class="sheet-footer">
      <van-button class="footer-btn" type="primary" @click="onEdit">编辑</van-button>
      <van-button class="footer-btn" type="danger" @click="onRemove">取消订阅</van-button>
      <van-button class="footer-btn" @click="onSearch">搜索</van-button>
      <van-button class="footer-btn" @click="onRefresh">刷新</van-button>
      <van-button class="footer-btn" @click="visible = false">关闭</van-button>
    </div>
  </van-action-sheet>
</template>

<style scoped>
.sheet-body {
  padding: 8px 16px 16px;
}

.media-header {
  display: flex;
  gap: 12px;
}

.media-poster {
  flex-shrink: 0;
  width: 84px;
  height: 116px;
  border-radius: 8px;
  overflow: hidden;
  background: #f2f3f5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8c9cc;
}

.media-info {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.media-name {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  line-height: 1.3;
}

.media-year {
  margin: 4px 0 8px;
  font-size: 13px;
  color: #969799;
}

.media-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.media-overview {
  margin-top: 12px;
  font-size: 13px;
  color: #646566;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.media-progress {
  margin-top: 12px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: #969799;
}

.media-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 12px;
}

.sheet-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 16px calc(12px + env(safe-area-inset-bottom));
}

.footer-btn {
  flex: 1;
  min-width: calc(50% - 5px);
  border-radius: 6px;
}
</style>
