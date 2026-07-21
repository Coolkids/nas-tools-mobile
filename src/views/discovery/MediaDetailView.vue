<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast, showConfirmDialog } from 'vant'
import MediaCard from '@/components/MediaCard.vue'
import PersonCard from '@/components/PersonCard.vue'
import AddRssMediaDialog from '@/components/AddRssMediaDialog.vue'
import { removeRssMedia } from '@/api/rss'
import {
  mediaDetail,
  mediaRecommendations,
  mediaPerson,
  proxyDoubanImage,
  type MediaDetail,
  type RecommendItem,
  type PersonItem
} from '@/api/discovery'

const route = useRoute()
const router = useRouter()

const media = ref<MediaDetail | null>(null)
const recommendations = ref<RecommendItem[]>([])
const persons = ref<PersonItem[]>([])
const loading = ref(false)
const refreshing = ref(false)
const errMsg = ref('')
const rssDialogVisible = ref(false)

async function loadAll(withToast = true) {
  const type = (route.query.type as string) || 'movie'
  const id = (route.query.id as string) || ''
  if (!id) {
    errMsg.value = '未指定媒体ID'
    return
  }
  loading.value = true
  errMsg.value = ''
  media.value = null
  recommendations.value = []
  persons.value = []
  if (withToast) showLoadingToast({ message: '加载中...', forbidClick: true })
  try {
    const res = await mediaDetail(type, id)
    if (res.code !== 0 || !res.data) {
      errMsg.value = res.msg || '未查询到TMDB媒体信息'
      return
    }
    media.value = res.data
    const tmdbid = res.data.tmdbid

    mediaRecommendations(type, tmdbid).then((r) => {
      if (r.code === 0) recommendations.value = r.data || []
    })
    mediaPerson(type, tmdbid).then((r) => {
      if (r.code === 0) persons.value = r.data || []
    })
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
    if (withToast) closeToast()
  }
}

async function onRefresh() {
  refreshing.value = true
  await loadAll(false)
  refreshing.value = false
}

async function onToggleFav() {
  if (!media.value) return

  if (media.value.fav === '1') {
    const ok = await showConfirmDialog({
      title: '取消订阅',
      message: `是否确定将 ${media.value.title} 从订阅中移除？`
    }).catch(() => false)
    if (!ok) return
    try {
      const mediaType = (route.query.type as string) || 'MOV'
      const res = await removeRssMedia({
        name: media.value.title,
        type: mediaType === 'TV' ? 'TV' : 'MOV',
        year: media.value.year,
        tmdbid: media.value.tmdbid
      })
      if (res.code === 0) {
        media.value.fav = '0'
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
  if (!media.value) return
  media.value.fav = '1'
  rssDialogVisible.value = false
}

function goSearchResource() {
  if (!media.value) return
  router.push({ path: '/search', query: { q: media.value.title } })
}

onMounted(loadAll)
watch(() => [route.query.type, route.query.id], loadAll)
</script>

<template>
  <div class="media-detail">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-alert v-if="errMsg" type="danger" :title="errMsg" />

      <template v-if="media">
        <div class="backdrop">
          <img v-if="media.background" :src="media.background" class="backdrop-img"
            @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div class="backdrop-mask" />
          <div class="backdrop-content">
            <img v-if="media.image" :src="media.image" class="poster"
              @error="($event.target as HTMLImageElement).style.display = 'none'" />
            <div v-else class="poster placeholder">
              <van-icon name="tv-o" size="32" />
            </div>
            <div class="info">
              <div v-if="media.fav === '2'" class="fav-badge">
                <van-icon name="success" /> 已下载
              </div>
              <h1 class="title">
                {{ media.title }}
                <span v-if="media.year" class="year">({{ media.year }})</span>
              </h1>
              <div class="meta">
                <van-tag v-if="media.tmdbid" type="success" size="small">TMDB: {{ media.tmdbid }}</van-tag>
                <van-tag v-if="media.vote && media.vote !== '0'" type="warning" size="small">评分 {{ media.vote }}</van-tag>
              </div>
              <div class="meta-text">{{ media.runtime }} {{ media.genres }}</div>
              <div class="actions">
                <van-button size="small" type="primary" @click="goSearchResource">搜索资源</van-button>
                <van-button size="small" :type="media.fav === '1' ? 'danger' : 'default'" @click="onToggleFav">
                  {{ media.fav === '1' ? '删除订阅' : '添加订阅' }}
                </van-button>
              </div>
            </div>
          </div>
        </div>

        <div class="body-content">
          <div class="block">
            <div class="section-title">简介</div>
            <p class="overview">{{ media.overview || '暂无简介' }}</p>
            <div v-if="media.crews?.length" class="crews">
              <div v-for="(crew, idx) in media.crews" :key="idx" class="crew-item">
                <strong>{{ Object.keys(crew)[0] }}</strong>
                <span class="text-muted">{{ Object.values(crew)[0] }}</span>
              </div>
            </div>
          </div>

          <div v-if="media.fact?.length" class="block">
            <div class="section-title">发布信息</div>
            <div class="fact-card">
              <div v-for="(fact, idx) in media.fact" :key="idx" class="fact-row">
                <span class="fact-label">{{ Object.keys(fact)[0] }}</span>
                <span class="fact-value">{{ Object.values(fact)[0] }}</span>
              </div>
            </div>
          </div>

          <div class="block">
            <div class="section-title">演员阵容</div>
            <div v-if="persons.length === 0" style="padding:12px;text-align:center;color:#969799;font-size:13px">暂无演员信息</div>
            <div v-else class="person-grid">
              <PersonCard
                v-for="person in persons" :key="person.id"
                :person-id="person.id" :image="person.image"
                :name="person.name" :role="person.role"
              />
            </div>
          </div>

          <div class="block">
            <div class="section-title">推荐影片</div>
            <div v-if="recommendations.length === 0" style="padding:12px;text-align:center;color:#969799;font-size:13px">暂无推荐</div>
            <div v-else class="media-grid">
              <MediaCard
                v-for="(item, idx) in recommendations" :key="`${item.id}-${idx}`"
                :tmdb-id="item.id" :title="item.title"
                :image="proxyDoubanImage(item.image)" :fav="item.fav"
                :vote="item.vote" :year="item.year"
                :overview="item.overview" :date="item.date"
                :media-type="item.type" :res-type="item.media_type"
                :show-sub="'1'"
              />
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="!errMsg" class="loading-tip">
        <van-loading size="20" /> 加载中...
      </div>
    </van-pull-refresh>
  </div>

  <AddRssMediaDialog
    v-model="rssDialogVisible"
    :type="(route.query.type as string) === 'tv' || (route.query.type as string) === 'TV' ? 'TV' : 'MOV'"
    :initial-name="media?.title"
    :initial-year="media?.year"
    :initial-keyword="media?.title"
    @success="onRssSuccess"
  />
</template>

<style scoped>
.backdrop {
  position: relative;
  min-height: 260px;
  overflow: hidden;
  background: #f2f3f5;
}
.backdrop-img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
}
.backdrop-mask {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2));
}
.backdrop-content {
  position: relative; display: flex; gap: 12px; padding: 16px; align-items: flex-end; min-height: 260px;
}
.poster {
  width: 100px; aspect-ratio: 2/3; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); flex-shrink: 0;
}
.poster.placeholder {
  display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1);
}
.info { flex: 1; color: #fff; min-width: 0; }
.fav-badge { display: inline-flex; align-items: center; gap: 4px; background: #2fb344; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-bottom: 6px; }
.title { margin: 0 0 6px; font-size: 20px; font-weight: 700; }
.year { font-size: 14px; font-weight: 400; opacity: 0.85; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.meta-text { font-size: 12px; opacity: 0.8; margin-bottom: 10px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.body-content { padding: 12px; }
.block { margin-bottom: 20px; }
.section-title { font-size: 15px; font-weight: 600; margin: 0 0 10px; padding-left: 8px; border-left: 3px solid var(--van-primary-color); }
.overview { color: #646566; line-height: 1.7; margin: 0; font-size: 14px; white-space: pre-line; }
.crews { margin-top: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.crew-item { font-size: 13px; }
.crew-item strong { display: block; margin-bottom: 2px; }
.text-muted { color: #969799; }
.fact-card { background: #f7f8fa; border-radius: 6px; padding: 6px 12px; }
.fact-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f2f3f5; font-size: 13px; }
.fact-row:last-child { border-bottom: none; }
.fact-label { font-weight: 600; min-width: 25%; }
.fact-value { color: #969799; text-align: right; word-break: break-all; }
.person-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.media-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
@media (min-width: 768px) {
  .media-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>
