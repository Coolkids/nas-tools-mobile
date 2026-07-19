<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useModalStore } from '@/stores/modal'
import {
  getLibraryMediacount,
  getLibrarySpacesize,
  getTransferStatistics,
  getLibraryPlayhistory,
  type MediaCountResult,
  type LibrarySpaceResult,
  type TransferStatisticsResult,
  type PlayHistoryItem
} from '@/api/system'

const router = useRouter()
const modal = useModalStore()
const loading = ref(false)

const mediaCount = ref<MediaCountResult>({ code: -1 })
const space = ref<LibrarySpaceResult>({ code: -1 })
const stat = ref<TransferStatisticsResult>({
  code: -1,
  MovieChartLabels: [],
  MovieNums: [],
  TvChartLabels: [],
  TvNums: [],
  AnimeNums: []
})
const history = ref<PlayHistoryItem[]>([])

const serverOk = computed(() => mediaCount.value.code === 0)

const totalStat = computed(() => {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + (b || 0), 0)
  return {
    movie: sum(stat.value.MovieNums),
    tv: sum(stat.value.TvNums),
    anime: sum(stat.value.AnimeNums)
  }
})

const usedPercentNum = computed(() => {
  const v = space.value.UsedPercent
  if (v === undefined || v === null || v === '') return 0
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
})

async function load() {
  loading.value = true
  const [mc, sp, st, ph] = await Promise.allSettled([
    getLibraryMediacount(),
    getLibrarySpacesize(),
    getTransferStatistics(),
    getLibraryPlayhistory()
  ])
  if (mc.status === 'fulfilled') mediaCount.value = mc.value
  if (sp.status === 'fulfilled') space.value = sp.value
  if (st.status === 'fulfilled') stat.value = st.value
  if (ph.status === 'fulfilled' && ph.value.code === 0) history.value = ph.value.result || []
  if (mc.status === 'rejected') showToast('媒体数量加载失败')
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="home page" v-if="!loading">
    <div v-if="!serverOk" class="alert-error">
      <van-icon name="warning-o" /> 媒体服务器连接失败，请确认 Emby/Jellyfin/Plex 配置是否正确。
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <van-icon name="tv-o" color="var(--van-primary-color)" size="24" />
        <div class="stat-body">
          <div class="stat-value">{{ mediaCount.Movie || 0 }}</div>
          <div class="stat-label">电影</div>
        </div>
      </div>
      <div class="stat-card">
        <van-icon name="video-o" color="var(--van-success-color)" size="24" />
        <div class="stat-body">
          <div class="stat-value">{{ mediaCount.Series || 0 }}</div>
          <div class="stat-label">电视剧</div>
        </div>
      </div>
      <div class="stat-card">
        <van-icon name="music-o" color="var(--van-warning-color)" size="24" />
        <div class="stat-body">
          <div class="stat-value">{{ mediaCount.Music || 0 }}</div>
          <div class="stat-label">音乐</div>
        </div>
      </div>
      <div class="stat-card">
        <van-icon name="contact" color="var(--van-danger-color)" size="24" />
        <div class="stat-body">
          <div class="stat-value">{{ mediaCount.User ?? 0 }}</div>
          <div class="stat-label">用户</div>
        </div>
      </div>
    </div>

    <van-cell-group inset style="margin: 12px">
      <van-cell title="存储空间">
        <template #value>
          <span style="font-size:12px;color:#969799">
            {{ space.TotalSpace || '-' }} / 已用 {{ usedPercentNum }}%
          </span>
        </template>
      </van-cell>
      <van-progress
        :percentage="usedPercentNum"
        :stroke-width="8"
        :show-pivot="false"
        style="margin: 0 16px 12px"
      />
      <van-cell title="已使用" :value="space.UsedSapce || '-'" />
      <van-cell title="空闲" :value="space.FreeSpace || '-'" />
    </van-cell-group>

    <van-cell-group inset style="margin: 12px">
      <van-cell title="转移统计（近 30 天）" />
      <van-cell>
        <div class="transfer-row">
          <div class="transfer-item">
            <van-icon name="tv-o" color="var(--van-primary-color)" />
            <span>电影</span>
            <span class="transfer-count">{{ totalStat.movie }}</span>
          </div>
          <div class="transfer-item">
            <van-icon name="video-o" color="var(--van-success-color)" />
            <span>电视剧</span>
            <span class="transfer-count">{{ totalStat.tv }}</span>
          </div>
          <div class="transfer-item">
            <van-icon name="music-o" color="var(--van-warning-color)" />
            <span>动漫</span>
            <span class="transfer-count">{{ totalStat.anime }}</span>
          </div>
        </div>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset style="margin: 12px" v-if="history.length">
      <van-cell title="播放历史" />
      <van-cell v-for="(item, i) in history.slice(0, 3)" :key="i" :title="item.event" :label="item.date" />
    </van-cell-group>

    <van-cell-group inset style="margin: 12px">
      <van-cell title="快捷操作" />
      <div class="quick-grid">
        <div v-for="card in [
          { name: 'mediafile', label: '文件管理', icon: 'description-o', color: '#ee0a24' },
          { name: 'service', label: '服务', icon: 'service-o', color: '#7232dd' },
          { name: 'history', label: '转移历史', icon: 'clock-o', color: '#07c160' },
          { name: 'unidentification', label: '手动识别', icon: 'edit', color: '#ee0a24' },
          { name: 'recommend', label: '发现', icon: 'fire-o', color: '#ff976a' },
          { name: 'ranking', label: '榜单', icon: 'bar-chart-o', color: '#1989fa' },
          { name: 'rss_history', label: '订阅历史', icon: 'records-o', color: '#07c160' },
          { name: 'rss_calendar', label: '订阅日历', icon: 'calendar-o', color: '#ff976a' },
        ]" :key="card.name" class="quick-card" @click="router.push({ name: card.name })">
          <div class="quick-icon" :style="{ background: card.color + '18', color: card.color }">
            <van-icon :name="card.icon" size="18" />
          </div>
          <div class="quick-label">{{ card.label }}</div>
        </div>
      </div>
    </van-cell-group>

    <div style="height: 40px" />
  </div>
  <div v-else class="loading-tip">
    <van-loading size="20" /> 加载中...
  </div>
</template>

<style scoped>
.home {
  padding: 12px;
}
.alert-error {
  background: #fee2e2;
  color: #dc2626;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px;
}
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.stat-body {
  flex: 1;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: #969799;
}
.transfer-row {
  display: flex;
  justify-content: space-around;
  width: 100%;
}
.transfer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.transfer-count {
  font-weight: 600;
  font-size: 18px;
}
.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; }
.quick-card { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
.quick-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.quick-label { font-size: 11px; color: #646566; }
</style>
