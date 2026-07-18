<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getRssHistory, deleteRssHistory, reRssHistory, type RssHistoryItem, type RssType } from '@/api/rss'

const loading = ref(false)
const items = ref<RssHistoryItem[]>([])
const activeType = ref<string>('')
const page = ref(1)
const total = ref(0)

const tabs = [
  { label: '全部', value: '' },
  { label: '电影', value: 'MOV' },
  { label: '电视剧', value: 'TV' },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getRssHistory((activeType.value || undefined) as RssType | undefined, page.value)
    if (res.code === 0) {
      items.value = res.result || []
      total.value = res.total || 0
    }
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function onTypeChange(t: string) {
  activeType.value = t
  page.value = 1
  load()
}

async function onDelete(item: RssHistoryItem) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除「${item.NAME}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteRssHistory(item.ID)
    if (res.code === 0) { showToast('删除成功'); load() }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

async function onReRss(item: RssHistoryItem) {
  try {
    const res = await reRssHistory(item.RSSID, item.TYPE as RssType)
    if (res.code === 0) { showToast('已重新订阅'); load() }
    else showToast(res.msg || '重新订阅失败')
  } catch { showToast('重新订阅失败') }
}
</script>

<template>
  <div class="rss-history page">
    <van-tabs v-model:active="activeType" @change="onTypeChange">
      <van-tab v-for="tab in tabs" :key="tab.value" :name="tab.value" :title="tab.label" />
    </van-tabs>

    <van-empty v-if="!loading && items.length === 0" description="暂无订阅历史" />

    <div v-else class="list">
      <van-cell
        v-for="item in items" :key="item.ID"
        :title="item.NAME"
        :label="`${item.TYPE === 'MOV' ? '电影' : '电视剧'} | ${item.YEAR || ''} | ${item.FINISH_TIME || ''}`"
      >
        <template #right-icon>
          <div style="display:flex;gap:4px;align-items:center">
            <van-tag size="small" @click="onReRss(item)">重新订阅</van-tag>
            <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click="onDelete(item)" />
          </div>
        </template>
      </van-cell>
    </div>
  </div>
</template>

<style scoped>
.list { padding: 0 12px; }
</style>
