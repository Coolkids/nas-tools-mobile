<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { showToast, showDialog, showConfirmDialog } from 'vant'
import { useModalStore } from '@/stores/modal'
import { getConfig, type AppConfig } from '@/api/config'
import {
  runScheduler, truncateBlacklist, truncateRsshistory,
  nameTest, netTest, NETTEST_TARGETS,
  type NameTestData, type NetTestResult
} from '@/api/system'

interface ServiceItem {
  id: string; name: string; type: 'scheduler' | 'manual'
  interval: string; state: boolean
}

const modal = useModalStore()
const loading = ref(false)
const services = ref<ServiceItem[]>([])

function asDigit(v: unknown): number | null {
  const s = String(v ?? ''); return /^\d+$/.test(s) ? Number(s) : null
}

function buildServices(cfg: AppConfig): ServiceItem[] {
  const pt = (cfg.pt || {}) as Record<string, unknown>
  const douban = (cfg.douban || {}) as Record<string, unknown>
  const list: ServiceItem[] = []
  const rss = asDigit(pt.pt_check_interval)
  list.push({ id: 'rssdownload', name: 'RSS订阅', type: 'scheduler', interval: rss !== null ? `${Math.round(rss / 60)} 分钟` : '未启用', state: rss !== null })
  let search = asDigit(pt.search_rss_interval)
  if (search !== null && search < 6) search = 6
  list.push({ id: 'subscribe_search_all', name: '订阅搜索', type: 'scheduler', interval: search !== null ? `${search} 小时` : '未启用', state: search !== null })
  const monitor = !!pt.pt_monitor
  list.push({ id: 'pttransfer', name: '下载文件转移', type: 'scheduler', interval: monitor ? '5 分钟' : '未启用', state: monitor })
  list.push({ id: 'autoremovetorrents', name: '自动删种', type: 'scheduler', interval: '需配置删种任务', state: false })
  const signin = pt.ptsignin_cron
  let signinInterval = '未启用'
  if (signin) signinInterval = String(signin).includes(':') ? String(signin) : `${signin} 小时`
  list.push({ id: 'ptsignin', name: '站点签到', type: 'scheduler', interval: signinInterval, state: !!signin })
  list.push({ id: 'sync', name: '目录同步', type: 'scheduler', interval: '实时监控', state: true })
  const doubanInterval = douban.interval
  list.push({ id: 'douban', name: '豆瓣想看', type: 'scheduler', interval: doubanInterval ? `${doubanInterval} 小时` : '未启用', state: !!doubanInterval })
  list.push({ id: 'blacklist', name: '清理转移缓存', type: 'manual', interval: '手动', state: false })
  list.push({ id: 'rsshistory', name: '清理RSS缓存', type: 'manual', interval: '手动', state: false })
  return list
}

async function load() {
  loading.value = true
  try {
    const res = await getConfig()
    services.value = buildServices(res.config || {})
  } catch {
    services.value = buildServices({})
    showToast('加载服务配置失败')
  } finally { loading.value = false }
}

async function runService(s: ServiceItem) {
  if (s.type === 'manual') {
    if (s.id === 'blacklist') {
      const ok = await showConfirmDialog({ title: '确认', message: '清理文件整理缓存后，已转移过的文件允许重新转移（包括识别错误的文件），是否确认？' }).catch(() => false)
      if (!ok) return
      try { await truncateBlacklist(); showToast('文件缓存清理完成！') } catch { showToast('清理失败') }
      return
    }
    if (s.id === 'rsshistory') {
      const ok = await showConfirmDialog({ title: '确认', message: '清理RSS缓存后，已订阅下载但未入库的资源可能会被重新下载，是否确认？' }).catch(() => false)
      if (!ok) return
      try { await truncateRsshistory(); showToast('RSS缓存清理完成！') } catch { showToast('清理失败') }
      return
    }
    return
  }
  const ok = await showConfirmDialog({ title: '确认', message: `是否立即运行 ${s.name}？` }).catch(() => false)
  if (!ok) return
  try { await runScheduler(s.id); showToast(`${s.name} 服务启动成功`) } catch { showToast('服务启动失败') }
}

const nameTestVisible = ref(false)
const nameTestInput = ref('')
const nameTestLoading = ref(false)
const nameTestResult = ref<NameTestData | { name: string } | null>(null)

async function doNameTest() {
  const name = nameTestInput.value.trim()
  if (!name) { showToast('请输入资源名称'); return }
  nameTestLoading.value = true
  nameTestResult.value = null
  try {
    const res = await nameTest(name)
    nameTestResult.value = res.code === 0 && res.data ? res.data : { name: '无法识别' }
  } catch { showToast('识别失败') } finally { nameTestLoading.value = false }
}

const netTestVisible = ref(false)
const netTestLoading = ref(false)
const netTestResults = ref<{ target: string; res?: boolean; time?: string; testing: boolean }[]>([])

function openNetTest() {
  netTestResults.value = NETTEST_TARGETS.map((t) => ({ target: t, testing: true }))
  netTestLoading.value = true
  netTestVisible.value = true
  Promise.all(netTestResults.value.map((r) =>
    netTest(r.target).then((ret: NetTestResult) => { r.res = ret.res; r.time = ret.time }).catch(() => { r.res = false; r.time = '失败' }).finally(() => { r.testing = false })
  )).finally(() => { netTestLoading.value = false })
}

onMounted(load)
</script>

<template>
  <div class="service page" v-if="!loading">
    <div class="stat-grid">
      <div class="stat-card">
        <van-icon name="apps-o" color="var(--van-primary-color)" size="22" />
        <div class="stat-body">
          <div class="stat-value">{{ services.length }}</div>
          <div class="stat-label">服务总数</div>
        </div>
      </div>
      <div class="stat-card">
        <van-icon name="success" color="var(--van-success-color)" size="22" />
        <div class="stat-body">
          <div class="stat-value">{{ services.filter(s => s.state).length }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </div>
    </div>

    <van-cell-group inset style="margin: 12px">
      <van-cell title="服务列表" />
      <van-cell
        v-for="s in services" :key="s.id"
        :title="s.name"
        :label="s.interval"
        is-link
        @click="runService(s)"
      >
        <template #value>
          <van-tag :type="s.state ? 'success' : 'danger'" size="small">{{ s.state ? 'ON' : 'OFF' }}</van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset style="margin: 12px">
      <van-cell title="测试工具" />
      <van-cell title="名称识别测试" is-link @click="nameTestVisible = true" />
      <van-cell title="网络连通性测试" is-link @click="openNetTest" />
    </van-cell-group>

    <van-action-sheet v-model:show="nameTestVisible" title="名称识别测试">
      <div style="padding: 16px">
        <van-field v-model="nameTestInput" placeholder="种子名/文件名等" @keypress.enter="doNameTest" />
        <van-button round block type="primary" :loading="nameTestLoading" @click="doNameTest" style="margin-top:12px">
          {{ nameTestLoading ? '识别中...' : '识别' }}
        </van-button>
        <div v-if="nameTestResult" style="margin-top:12px;font-size:13px">
          <template v-if="'title' in nameTestResult">
            <van-tag type="warning">{{ '识别名称：' + (nameTestResult as NameTestData).name }}</van-tag>
            <div style="margin-top:8px">
              <van-tag type="success" style="margin:2px">标题：{{ (nameTestResult as NameTestData).title }}</van-tag>
              <van-tag v-if="(nameTestResult as NameTestData).tmdbid" type="primary" style="margin:2px">TMDB: {{ (nameTestResult as NameTestData).tmdbid }}</van-tag>
              <van-tag v-if="(nameTestResult as NameTestData).year" type="warning" style="margin:2px">年份：{{ (nameTestResult as NameTestData).year }}</van-tag>
              <van-tag v-if="(nameTestResult as NameTestData).restype" style="margin:2px">质量：{{ (nameTestResult as NameTestData).restype }}</van-tag>
            </div>
          </template>
          <template v-else>
            <van-tag type="danger">{{ nameTestResult.name }}</van-tag>
          </template>
        </div>
      </div>
    </van-action-sheet>

    <van-action-sheet v-model:show="netTestVisible" title="网络连通性测试">
      <div style="padding: 16px">
        <van-cell v-for="r in netTestResults" :key="r.target" :title="r.target">
          <template #value>
            <van-loading v-if="r.testing" size="16" />
            <van-tag v-else :type="r.res ? 'success' : 'danger'" size="small">{{ r.res ? '连通' : '断开' }}</van-tag>
          </template>
        </van-cell>
      </div>
    </van-action-sheet>

    <div style="height:20px" />
  </div>
  <van-loading v-else size="20" style="padding:40px;text-align:center" />
</template>

<style scoped>
.stat-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 12px;
}
.stat-card {
  background: #fff; border-radius: 8px; padding: 14px;
  display: flex; align-items: center; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.stat-body { flex: 1; }
.stat-value { font-size: 22px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 12px; color: #969799; }
</style>
