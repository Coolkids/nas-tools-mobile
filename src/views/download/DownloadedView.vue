<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { useRouter } from 'vue-router'
import { getRecommend, proxyDoubanImage, type RecommendItem } from '@/api/discovery'

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)
const items = ref<RecommendItem[]>([])
const page = ref(1)
const hasMore = ref(true)

onMounted(() => load(1))

async function load(p?: number) {
  if (p) page.value = p
  loading.value = true
  try {
    const res = await getRecommend({ type: 'DOWNLOADED', page: page.value })
    if (res.code === 0) {
      const list = res.Items || []
      if (page.value === 1) items.value = list
      else items.value = items.value.concat(list)
      hasMore.value = list.length > 0
    } else {
      showToast(res.msg || '加载失败')
    }
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

async function onRefresh() {
  refreshing.value = true
  await load(1)
  refreshing.value = false
}

async function onLoadMore() {
  if (loading.value || !hasMore.value) return
  page.value++
  await load()
}

function goDetail(item: RecommendItem) {
  if (item.tmdbid && item.media_type) {
    router.push({ path: '/media_detail', query: { type: item.media_type, id: String(item.tmdbid) } })
  }
}
</script>

<template>
  <div class="downloaded page">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-empty v-if="!loading && items.length === 0" description="暂无最近下载" />
      <div v-else class="card-list">
        <div
          v-for="(item, idx) in items" :key="`${item.id}-${idx}`"
          class="download-card"
          @click="goDetail(item)"
        >
          <img :src="proxyDoubanImage(item.image)" class="card-poster" />
          <div class="card-body">
            <div class="card-title">{{ item.title }}</div>
            <div class="card-meta">
              <van-tag v-if="item.media_type" size="small" :type="item.media_type === 'MOV' ? 'primary' : 'success'">
                {{ item.media_type === 'MOV' ? '电影' : '电视剧' }}
              </van-tag>
              <span v-if="item.year" class="meta-text">{{ item.year }}</span>
            </div>
            <div v-if="item.date" class="card-date">{{ item.date }}</div>
          </div>
          <van-icon name="arrow" class="card-arrow" />
        </div>
        <div v-if="hasMore" class="load-more">
          <van-loading v-if="loading" size="16" />
          <span v-else @click="onLoadMore">点击加载更多</span>
        </div>
      </div>
    </van-pull-refresh>
    <van-back-top :bottom="70" />
  </div>
</template>

<style scoped>
.card-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.download-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  cursor: pointer;
}
.card-poster {
  width: 50px;
  height: 70px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f2f3f5;
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
}
.meta-text {
  font-size: 12px;
  color: #969799;
}
.card-date {
  font-size: 11px;
  color: #969799;
}
.card-arrow {
  font-size: 14px;
  color: #c8c9cc;
  flex-shrink: 0;
}
.load-more {
  text-align: center;
  padding: 12px;
  font-size: 13px;
  color: #969799;
  cursor: pointer;
}
</style>
