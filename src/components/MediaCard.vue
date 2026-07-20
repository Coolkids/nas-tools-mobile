<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon, showToast, showConfirmDialog } from 'vant'
import AddRssMediaDialog from './AddRssMediaDialog.vue'
import { removeRssMedia } from '@/api/rss'

const props = defineProps<{
  tmdbId?: string | number
  title?: string
  image?: string
  fav?: string
  vote?: string | number
  year?: string
  overview?: string
  date?: string
  mediaType?: string
  resType?: string
  showSub?: string
  site?: string
  weekday?: string
}>()

const emit = defineEmits<{ (e: 'fav-change', fav: string): void }>()

const router = useRouter()
const rssDialogVisible = ref(false)

function goDetail() {
  if (props.tmdbId && props.mediaType) {
    router.push({ path: '/media_detail', query: { type: props.mediaType, id: String(props.tmdbId) } })
  }
}

async function onLoveClick() {
  if (!props.title || !props.tmdbId) return

  if (props.fav === '1') {
    const ok = await showConfirmDialog({
      title: '取消订阅',
      message: `是否确定将 ${props.title} 从订阅中移除？`
    }).catch(() => false)
    if (!ok) return
    try {
      const res = await removeRssMedia({
        name: props.title,
        type: props.mediaType === 'TV' ? 'TV' : 'MOV',
        year: props.year,
        tmdbid: props.tmdbId
      })
      if (res.code === 0) {
        emit('fav-change', '0')
        showToast('已取消订阅')
      } else {
        showToast(res.msg || '取消订阅失败')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '取消订阅失败')
    }
  } else {
    rssDialogVisible.value = true
  }
}

function onRssSuccess() {
  emit('fav-change', '1')
  rssDialogVisible.value = false
}

const voteText = computed(() => {
  if (props.vote === undefined || props.vote === null) return ''
  const s = String(props.vote).replace(/[\[\]]/g, '').trim()
  if (!s || s === '0' || s === '0.0') return ''
  return s
})
</script>

<template>
  <div class="media-card" @click="goDetail">
    <div class="card-poster">
      <img
        v-if="image"
        :src="image"
        :alt="title"
        class="poster-img"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="poster-placeholder">
        <Icon name="fire-o" size="32" />
      </div>

      <span v-if="weekday" class="badge badge-weekday">{{ weekday }}</span>
      <span v-else-if="resType" class="badge" :class="resType === '电影' ? 'badge-movie' : 'badge-tv'">{{ resType }}</span>

      <div v-if="fav === '2'" class="badge badge-downloaded">
        <Icon name="success" />
      </div>
      <div v-else-if="voteText" class="badge badge-vote">{{ voteText }}</div>

      <div class="card-overlay">
        <div class="overlay-content">
          <div v-if="site || year" class="overlay-year">{{ site || year }}</div>
          <h3 v-if="title" class="overlay-title">{{ title }}</h3>
          <p v-if="overview" class="overlay-overview">{{ overview }}</p>
          <small v-if="date" class="overlay-date">{{ date }}</small>
        </div>
        <div v-if="showSub === '1'" class="overlay-actions">
          <Icon name="search" class="action-icon" title="搜索资源" />
          <Icon
            :name="fav === '1' ? 'star' : 'star-o'"
            class="action-icon"
            :class="{ 'icon-filled': fav === '1' }"
            title="加入/取消订阅"
            @click.stop="onLoveClick"
          />
        </div>
      </div>
    </div>
  </div>

  <AddRssMediaDialog
    v-model="rssDialogVisible"
    :type="mediaType === 'TV' ? 'TV' : 'MOV'"
    :initial-name="title"
    :initial-year="year"
    :initial-keyword="title"
    @success="onRssSuccess"
  />
</template>

<style scoped>
.media-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 2 / 3;
  background-color: #f2f3f5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.15s;
}
.media-card:active {
  transform: scale(0.97);
}
.card-poster {
  width: 100%;
  height: 100%;
  position: relative;
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
.badge {
  position: absolute;
  top: 6px;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  color: #fff;
  line-height: 1.5;
}
.badge-weekday { left: 6px; background: #e8590c; }
.badge-movie { left: 6px; background: #2fb344; }
.badge-tv { left: 6px; background: #4299e1; }
.badge-downloaded { right: 6px; background: #2fb344; padding: 2px 4px; }
.badge-vote { right: 6px; background: #8957e5; }
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
}
.media-card:hover .card-overlay,
.media-card:active .card-overlay {
  opacity: 1;
}
.overlay-content {
  color: #fff;
  overflow: hidden;
}
.overlay-year { font-weight: 700; margin-bottom: 2px; font-size: 12px; }
.overlay-title {
  margin: 0 0 2px;
  font-size: 14px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.overlay-overview {
  margin: 0 0 2px;
  font-size: 11px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.overlay-date { font-size: 10px; }
.overlay-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.action-icon {
  color: #fff;
  font-size: 18px;
}
.icon-filled {
  color: #ee0a24;
}
</style>
