<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getTmdbCache, deleteTmdbCache, clearTmdbCache, type TmdbCacheItem } from '@/api/rename'

const loading = ref(false)
const items = ref<TmdbCacheItem[]>([])
const page = ref(1)
const total = ref(0)

const TMDB_IMG = 'https://image.tmdb.org/t/p/w154'

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

function posterUrl(path?: string) {
  return path ? TMDB_IMG + path : ''
}

function mediaTypeLabel(t: string) {
  if (t === 'MOV') return '电影'
  if (t === 'TV') return '电视剧'
  return t
}
</script>

<template>
  <div class="tmdb-cache page">
    <div style="padding:8px 12px;display:flex;gap:8px">
      <van-button size="small" plain icon="replay" @click="load">刷新</van-button>
      <van-button size="small" plain type="danger" icon="delete-o" @click="onClear">清空缓存</van-button>
    </div>

    <van-empty v-if="!loading && items.length === 0" description="暂无TMDB缓存" />

    <div v-else class="card-list">
      <div v-for="[key, info, _] in items" :key="key" class="cache-card">
        <img
          v-if="info.poster_path"
          :src="posterUrl(info.poster_path)"
          class="card-poster"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <div v-else class="card-poster placeholder">
          <van-icon name="fire-o" size="24" color="#c8c9cc" />
        </div>
        <div class="card-body">
          <div class="card-title">{{ info.title }}</div>
          <div class="card-meta">
            <van-tag v-if="info.media_type" size="small" :type="info.media_type === 'MOV' ? 'primary' : 'success'">
              {{ mediaTypeLabel(info.media_type) }}
            </van-tag>
            <span v-if="info.year" class="meta-year">{{ info.year }}</span>
          </div>
          <div class="card-key">{{ key }}</div>
        </div>
        <van-icon name="delete" class="card-delete" @click="onDelete(key)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cache-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.card-poster {
  width: 44px;
  height: 66px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f2f3f5;
}
.card-poster.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-body {
  flex: 1;
  min-width: 0;
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
  margin-top: 4px;
}
.meta-year {
  font-size: 12px;
  color: #969799;
}
.card-key {
  font-size: 11px;
  color: #c8c9cc;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-delete {
  font-size: 18px;
  color: #ee0a24;
  padding: 8px;
  flex-shrink: 0;
}
</style>
