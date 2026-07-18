<script setup lang="ts">
import { computed } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { removeRssMedia, type RssMediaItem, type RssType } from '@/api/rss'
import { useModalStore } from '@/stores/modal'

const props = defineProps<{
  modelValue: boolean
  item: RssMediaItem | null
  type: RssType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'removed'): void
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
</script>

<template>
  <van-action-sheet v-model:show="visible" :title="item?.name || '订阅详情'">
    <div v-if="item" style="padding: 16px">
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <img :src="item.poster || item.image" style="width:80px;height:110px;object-fit:cover;border-radius:6px" />
        <div style="flex:1">
          <div style="font-size:16px;font-weight:600;">{{ item.name }}</div>
          <div v-if="item.year" style="font-size:13px;color:#969799;margin:4px 0">{{ item.year }}</div>
          <van-tag size="small" :type="stateMeta(item.state).type">{{ stateMeta(item.state).label }}</van-tag>
          <van-tag v-if="item.over_edition" size="small" type="danger" style="margin-left:4px">洗版</van-tag>
        </div>
      </div>
      <div v-if="item.overview" style="font-size:13px;color:#646566;line-height:1.6;margin-bottom:12px">{{ item.overview }}</div>
      <van-progress v-if="type === 'TV' && item.total && item.total > 0" :percentage="progressOf(item)" :stroke-width="6" style="margin-bottom:12px" />
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
        <van-tag v-if="item.filter_restype" size="small">{{ item.filter_restype }}</van-tag>
        <van-tag v-if="item.filter_pix" size="small">{{ item.filter_pix }}</van-tag>
        <van-tag v-if="item.filter_team" size="small" plain>{{ item.filter_team }}</van-tag>
      </div>
      <van-button round block type="danger" @click="onRemove">取消订阅</van-button>
    </div>
  </van-action-sheet>
</template>
