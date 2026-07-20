<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useWindowSize } from '@vant/use'
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

/* 根据设备模式/方向决定播放历史显示条数，保证一屏放下、无滚动条 */
const { width: winW, height: winH } = useWindowSize()
const historyLimit = computed(() => {
  const w = winW.value
  const h = winH.value
  const landscapePhone = w > h && h <= 700 // 横屏（手机及矮高度宽屏设备）
  if (landscapePhone) return h >= 420 ? 2 : h >= 385 ? 1 : 0
  const portraitPhone = w < 768 && h >= w // 手机竖屏
  if (portraitPhone) return h >= 680 ? 3 : 2
  return h >= 940 ? 3 : 2 // 平板按高度适配
})

/* 横屏高度不足时，完整播放历史通过弹窗展示 */
const showHistoryPopup = ref(false)

const usedPercentNum = computed(() => {
  const v = space.value.UsedPercent
  if (v === undefined || v === null || v === '') return 0
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
})

const SPARK_W = 160
const SPARK_H = 56

function smoothPath(data: number[]): string {
  if (!data || data.length < 2) return ''
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * SPARK_W,
    y: SPARK_H - (v / max) * (SPARK_H - 8) - 4
  }))
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const cpx = a.x + (b.x - a.x) / 2
    d += `C${cpx},${a.y} ${cpx},${b.y} ${b.x},${b.y}`
  }
  return d
}

const movieSparkPath = computed(() => smoothPath(stat.value.MovieNums))
const tvSparkPath = computed(() => smoothPath(stat.value.TvNums))
const animeSparkPath = computed(() => smoothPath(stat.value.AnimeNums))

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
        <svg class="sparkline" :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`">
          <path v-if="movieSparkPath" :d="movieSparkPath" fill="none" stroke="var(--van-primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <van-icon name="tv-o" color="var(--van-primary-color)" size="24" />
        <div class="stat-body">
          <div class="stat-value">{{ mediaCount.Movie || 0 }}</div>
          <div class="stat-label">电影</div>
        </div>
      </div>
      <div class="stat-card">
        <svg class="sparkline" :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`">
          <path v-if="tvSparkPath" :d="tvSparkPath" fill="none" stroke="var(--van-success-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path v-if="animeSparkPath" :d="animeSparkPath" fill="none" stroke="var(--van-warning-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <van-icon name="video-o" color="var(--van-success-color)" size="24" />
        <div class="stat-body">
          <div class="stat-value">{{ mediaCount.Series || 0 }}</div>
          <div class="stat-label">电视剧/动漫</div>
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
          <div class="stat-label">活跃用户</div>
        </div>
      </div>
    </div>

    <div class="right-col">
      <van-cell-group inset class="storage-group">
        <van-cell title="存储空间">
          <template #value>
            <span style="font-size:12px;color:#969799">
              {{ space.TotalSpace || '-' }} / 已用 {{ usedPercentNum }}%
            </span>
          </template>
        </van-cell>
        <van-progress
          class="storage-progress"
          :percentage="usedPercentNum"
          :stroke-width="8"
          :show-pivot="false"
        />
        <van-cell title="已使用" :value="space.UsedSapce || '-'" />
        <van-cell title="空闲" :value="space.FreeSpace || '-'" />
      </van-cell-group>

      <van-cell-group inset class="history-group" v-if="history.length">
        <van-cell title="播放历史" />
        <van-cell v-for="(item, i) in history.slice(0, historyLimit)" :key="i" :title="item.event" :label="item.date" />
        <van-cell
          v-if="history.length > historyLimit"
          class="history-more"
          :title="`查看全部（${history.length}）`"
          is-link
          @click="showHistoryPopup = true"
        />
      </van-cell-group>

      <van-cell-group inset class="quick-group">
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
    </div>
    <div class="spacer"></div>
  </div>
  <div v-else class="loading-tip">
    <van-loading size="20" /> 加载中...
  </div>

  <!-- 横屏高度不足时，通过弹窗展示完整播放历史 -->
  <van-popup
    v-model:show="showHistoryPopup"
    round
    position="bottom"
    safe-area-inset-bottom
    class="history-popup"
  >
    <div class="history-popup-header">
      <span>播放历史</span>
      <van-icon name="cross" @click="showHistoryPopup = false" />
    </div>
    <div class="history-popup-body">
      <van-cell v-for="(item, i) in history" :key="i" :title="item.event" :label="item.date" />
    </div>
  </van-popup>
</template>

<style scoped>
/* ── Shared / base (平板及兜底布局) ── */
.home {
  padding: 12px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.alert-error {
  background: #fee2e2; color: #dc2626; padding: 10px 12px;
  border-radius: 8px; font-size: 13px; margin-bottom: 12px;
  display: flex; align-items: center; gap: 6px;
  flex-shrink: 0;
}
.stat-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 10px; padding: 0 0 8px;
}
.stat-card {
  background: #fff; border-radius: 8px; padding: 14px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  position: relative; overflow: hidden;
  min-height: 0;
}
.stat-body { flex: 1; min-width: 0; }
.stat-value { font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 11px; color: #969799; }
.sparkline {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; opacity: 0.35;
}
.right-col { display: flex; flex-direction: column; }
.home .van-cell-group { margin: 0 0 12px !important; }
.home .van-cell-group:last-child { margin-bottom: 0 !important; }
.storage-progress { margin: 0 16px 12px; }
.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px; }
.quick-card { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; min-height: 0; }
.quick-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.quick-label { font-size: 11px; color: #646566; }
.spacer { flex: 1; min-height: 4px; }
/* "查看全部"仅横屏模式显示（配合弹窗） */
.home .history-more { display: none; }
.history-popup { max-height: 70%; }
.history-popup-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px 10px; font-size: 15px; font-weight: 600;
}
.history-popup-header .van-icon { color: #969799; cursor: pointer; }
.history-popup-body { max-height: 55vh; overflow-y: auto; padding-bottom: 8px; }

/* ════════════════════════════════════════════════
   手机竖屏：保持当前布局，一屏铺满，高度不够则压缩元素
   ════════════════════════════════════════════════ */
@media (max-width: 767px) and (orientation: portrait) {
  .home {
    min-height: 0;
    height: calc(100vh - var(--app-header-height, 46px) - var(--app-tabbar-height, 50px)
      - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2px);
    height: calc(100dvh - var(--app-header-height, 46px) - var(--app-tabbar-height, 50px)
      - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2px);
    overflow: hidden;
    padding: 8px;
  }
  .alert-error { padding: 6px 10px; font-size: 12px; margin-bottom: 6px; }
  .stat-grid { gap: 6px; padding: 0 0 6px; }
  .stat-card { padding: 10px 12px; gap: 8px; }
  .stat-value { font-size: 18px; }
  .stat-label { font-size: 10px; }
  /* 右列占满剩余空间；分组可整体收缩（内部裁剪），快捷操作吸收多余空间 */
  .right-col { flex: 1; min-height: 0; overflow: hidden; }
  .home .van-cell-group { margin: 0 0 6px !important; flex: 0 1 auto; min-height: 0; overflow: hidden; }
  .home .van-cell-group:last-child { margin-bottom: 0 !important; }
  .home .van-cell { padding: 7px 12px !important; }
  .storage-progress { margin: 0 12px 8px; }
  .quick-group { flex: 1 0 auto !important; display: flex; flex-direction: column; }
  .quick-grid { flex: 1; min-height: 0; gap: 4px; padding: 4px; align-content: space-evenly; }
  .quick-card { gap: 4px; }
  .quick-icon { width: 28px; height: 28px; }
  .quick-icon .van-icon { font-size: 14px !important; }
  .quick-label { font-size: 10px; }
  .spacer { display: none; }
}

/* 手机竖屏 - 矮屏（≤680px 高）进一步压缩每个元素高度 */
@media (max-width: 767px) and (orientation: portrait) and (max-height: 680px) {
  .stat-card { padding: 6px 10px; gap: 6px; }
  .stat-card .van-icon { font-size: 18px !important; }
  .stat-value { font-size: 16px; }
  .stat-label { font-size: 9px; }
  .home .van-cell { padding: 4px 10px !important; }
  .storage-progress { margin: 0 10px 6px; }
  .quick-grid { gap: 2px; padding: 2px; }
  .quick-card { gap: 2px; }
  .quick-icon { width: 24px; height: 24px; }
  .quick-icon .van-icon { font-size: 12px !important; }
  .quick-label { font-size: 9px; }
}

/* ════════════════════════════════════════════════
   手机横屏：左右布局（左：4 个统计；右：存储/历史/快捷操作）
   用 max-height 区分横屏紧凑模式与平板；
   高度不足时播放历史仅显示 0-2 条，其余通过弹窗查看
   ════════════════════════════════════════════════ */
@media (orientation: landscape) and (max-height: 700px) {
  .home {
    min-height: 0;
    height: calc(100vh - var(--app-header-height, 46px) - var(--app-tabbar-height, 50px)
      - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2px);
    height: calc(100dvh - var(--app-header-height, 46px) - var(--app-tabbar-height, 50px)
      - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2px);
    overflow: hidden;
    padding: 6px;
    flex-direction: row;
    gap: 6px;
    position: relative;
  }
  .alert-error {
    position: absolute; z-index: 2; left: 6px; right: 6px; top: 6px;
    padding: 4px 10px; font-size: 11px; margin: 0;
  }
  /* 左侧：4 个统计 2x2，自动撑满高度 */
  .stat-grid {
    flex: 0 0 40%;
    grid-template-columns: 1fr 1fr;
    gap: 6px; padding: 0;
  }
  .stat-card { padding: 6px 10px; gap: 6px; }
  .stat-card .van-icon { font-size: 20px !important; }
  .stat-value { font-size: 16px; }
  .stat-label { font-size: 10px; }
  .sparkline { opacity: 0.25; }
  /* 右侧：分组自然高度、空间不足时整体收缩裁剪（单元格不被压扁） */
  .right-col { flex: 1; min-width: 0; min-height: 0; gap: 6px; overflow: hidden; }
  .home .van-cell-group,
  .home .van-cell-group:last-child {
    flex: 0 1 auto; min-height: 0; margin: 0 !important;
    overflow: hidden;
  }
  /* 压缩单元格行高与字号，使三组在极小高度内放下 */
  .home .van-cell {
    padding: 2px 10px !important;
    font-size: 13px !important;
    line-height: 18px !important;
  }
  .home .van-cell :deep(.van-cell__label) {
    font-size: 11px; line-height: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .home .history-more { display: flex; }
  .home .history-more :deep(.van-cell__title) { color: var(--van-primary-color); }
  .storage-progress { margin: 0 10px 5px; }
  /* 快捷操作只扩张不收缩，网格行均匀铺满剩余空间 */
  .quick-group { flex: 1 0 auto !important; display: flex; flex-direction: column; }
  .quick-grid {
    flex: 1; min-height: 0;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px; padding: 2px;
    align-content: space-evenly;
  }
  .quick-card { gap: 2px; }
  .quick-icon { width: 22px; height: 22px; }
  .quick-icon .van-icon { font-size: 12px !important; }
  .quick-label { font-size: 9px; }
  .spacer { display: none; }
}

/* 横屏 - 较高屏幕（501~700px 高，如矮屏平板/分屏）元素放大 */
@media (orientation: landscape) and (min-height: 501px) and (max-height: 700px) {
  .stat-card .van-icon { font-size: 28px !important; }
  .stat-value { font-size: 22px; }
  .stat-label { font-size: 12px; }
  .home .van-cell {
    padding: 6px 14px !important;
    font-size: 14px !important;
    line-height: 22px !important;
  }
  .home .van-cell :deep(.van-cell__label) { font-size: 12px; line-height: 16px; }
  .storage-progress { margin: 0 12px 8px; }
  .quick-icon { width: 32px; height: 32px; }
  .quick-icon .van-icon { font-size: 17px !important; }
  .quick-label { font-size: 11px; }
  .quick-card { gap: 4px; }
}

/* ════════════════════════════════════════════════
   平板（横竖屏通用）：保持当前布局，按分辨率铺满，无滚动条
   尺寸随视口高度缩放（clamp），统计卡与快捷网格吸收剩余空间
   ════════════════════════════════════════════════ */
@media (min-width: 768px) and (min-height: 701px) {
  .home {
    min-height: 0;
    height: calc(100vh - var(--app-header-height, 46px) - var(--app-tabbar-height, 50px)
      - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2px);
    height: calc(100dvh - var(--app-header-height, 46px) - var(--app-tabbar-height, 50px)
      - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2px);
    overflow: hidden;
    padding: 10px 24px;
  }
  .alert-error { margin-bottom: 10px; }
  /* 统计卡：行高 1fr，随剩余空间增高 */
  .stat-grid {
    flex: 1 1 auto; min-height: 0;
    grid-template-rows: 1fr 1fr;
    gap: 10px; padding: 0 0 10px;
  }
  .stat-card { padding: 8px 16px; gap: 12px; }
  .stat-card .van-icon { font-size: clamp(24px, 3.5vh, 32px) !important; }
  .stat-value { font-size: clamp(20px, 3vh, 28px); }
  .stat-label { font-size: clamp(11px, 1.6vh, 13px); }
  .right-col { flex: 1.6 1 auto; min-height: 0; overflow: hidden; }
  .home .van-cell-group { margin: 0 0 10px !important; flex: 0 0 auto; min-height: 0; overflow: hidden; }
  .home .van-cell { padding: clamp(4px, 0.9vh, 10px) 16px !important; }
  .storage-progress { margin: 0 16px clamp(4px, 0.9vh, 10px); }
  /* 快捷操作吸收剩余空间，网格行均匀铺开，实现"铺满" */
  .quick-group {
    flex: 1 1 auto !important; min-height: 0; margin-bottom: 0 !important;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .quick-grid {
    flex: 1; min-height: 0;
    gap: clamp(5px, 1.2vh, 14px);
    padding: clamp(5px, 1.2vh, 16px);
    align-content: space-evenly;
  }
  .quick-icon { width: clamp(32px, 5vh, 48px); height: clamp(32px, 5vh, 48px); }
  .quick-icon .van-icon { font-size: clamp(16px, 2.6vh, 24px) !important; }
  .quick-label { font-size: clamp(11px, 1.6vh, 13px); }
  .spacer { display: none; }
}
</style>
