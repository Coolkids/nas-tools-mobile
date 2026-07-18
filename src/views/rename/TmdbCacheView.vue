<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getTmdbCache, deleteTmdbCache, clearTmdbCache, type TmdbCacheItem } from '@/api/rename'

const loading = ref(false)
const items = ref<TmdbCacheItem[]>([])
const page = ref(1)
const total = ref(0)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getTmdbCache({ page: page.value })
    if (res.code === 0) {
      items.value = res.result || []
      total.value = res.total || 0
    }
  } catch { showToast('加载失败') } finally { loading.value = false }
}

async function onClear() {
  const ok = await showConfirmDialog({ title: '清空', message: '确认清空TMDB缓存？' }).catch(() => false)
  if (!ok) return
  try { await clearTmdbCache(); showToast('清空成功'); load() }
  catch { showToast('清空失败') }
}

async function onDelete(key: string) {
  try { await deleteTmdbCache(key); showToast('删除成功'); load() }
  catch { showToast('删除失败') }
}
</script>

<template>
  <div class="tmdb-cache page">
    <div style="padding:8px 12px;display:flex;gap:8px">
      <van-button size="small" @click="load">刷新</van-button>
      <van-button size="small" type="danger" @click="onClear">清空缓存</van-button>
    </div>

    <van-empty v-if="!loading && items.length === 0" description="暂无TMDB缓存" />

    <div v-else class="list">
      <van-cell-group>
        <van-cell
          v-for="[key, info, _] in items" :key="key"
          :title="info.title"
          :label="`${info.year} | ${info.media_type}`"
        >
          <template #right-icon>
            <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click="onDelete(key)" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>
