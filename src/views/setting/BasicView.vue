<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { useConfigForm } from '@/composables/useConfigForm'
import { RMT_MODES } from '@/utils/rmtMode'

const { config, loading, saving, load, save } = useConfigForm()

interface Option {
  value: string
  label: string
}

const LOG_TYPES: Option[] = [
  { value: 'console', label: '控制台' },
  { value: 'file', label: '文件' },
  { value: 'server', label: '日志中心' }
]
const LOG_LEVELS: Option[] = [
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
  { value: 'error', label: 'ERROR' }
]
const WALLPAPER_OPTIONS: Option[] = [
  { value: 'themoviedb', label: '电影海报' },
  { value: 'bing', label: 'Bing每日壁纸' }
]
const TMDB_DOMAINS: Option[] = [
  { value: 'api.themoviedb.org', label: 'api.themoviedb.org' },
  { value: 'api.tmdb.org', label: 'api.tmdb.org' }
]
const MATCH_MODES: Option[] = [
  { value: 'normal', label: '正常模式' },
  { value: 'strict', label: '严格模式' }
]
const DOWNLOAD_ORDERS: Option[] = [
  { value: '', label: '默认' },
  { value: 'site', label: '站点优先' },
  { value: 'seeder', label: '做种数优先' }
]

const activeTab = ref('system')

const form = reactive<Record<string, unknown>>({})

const releaseGroupsVisible = ref(false)
const releaseGroups = ref('')

// 通用选项选择器
const pickerVisible = ref(false)
const pickerTitle = ref('')
const pickerKey = ref('')
const pickerColumns = ref<{ text: string; value: string }[]>([])
const pickerValue = ref<string[]>([])

function optionLabel(options: Option[], val: unknown): string {
  const hit = options.find(o => o.value === String(val ?? ''))
  return hit ? hit.label : String(val ?? '')
}

function openPicker(title: string, key: string, options: Option[]) {
  pickerTitle.value = title
  pickerKey.value = key
  pickerColumns.value = options.map(o => ({ text: o.label, value: o.value }))
  pickerValue.value = [String(form[key] ?? '')]
  pickerVisible.value = true
}

function onPickerConfirm({ selectedOptions }: { selectedOptions: { value: string }[] }) {
  if (selectedOptions[0]) form[pickerKey.value] = selectedOptions[0].value
  pickerVisible.value = false
}

function getCfg(path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = config.value
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function syncForm() {
  const str = (path: string, def = ''): string => {
    const v = getCfg(path)
    return v === undefined || v === null ? def : String(v)
  }
  const sw = (path: string): boolean => !!getCfg(path)

  const sysKeys = ['app.logtype', 'app.logpath', 'app.logserver', 'app.loglevel',
    'app.wallpaper', 'app.web_port', 'app.login_user', 'app.login_password',
    'app.ssl_cert', 'app.ssl_key', 'app.proxies', 'app.domain', 'app.user_agent']
  sysKeys.forEach(k => {
    if (k === 'app.proxies') {
      const proxies = getCfg('app.proxies') as { http?: string } | undefined
      let p = proxies?.http || ''
      if (p.startsWith('http://')) p = p.replace('http://', '')
      form[k] = p
    } else {
      form[k] = str(k)
    }
  })
  form['app.logtype'] = str('app.logtype', 'console')
  form['app.wallpaper'] = str('app.wallpaper', 'themoviedb')
  form['app.loglevel'] = str('app.loglevel', 'info')

  const mediaKeys = ['app.rmt_tmdbkey', 'app.tmdb_domain', 'app.rmt_match_mode',
    'media.category', 'pt.rmt_mode', 'media.min_filesize', 'media.ignored_paths',
    'media.ignored_files', 'pt.download_order', 'media.movie_name_format',
    'media.tv_name_format', 'media.filesize_cover', 'media.refresh_mediaserver',
    'media.nfo_poster']
  mediaKeys.forEach(k => { if (typeof form[k] === 'undefined') form[k] = str(k) })
  form['pt.rmt_mode'] = str('pt.rmt_mode', 'copy')
  form['app.rmt_match_mode'] = str('app.rmt_match_mode', 'normal')
  form['media.filesize_cover'] = sw('media.filesize_cover')
  form['media.refresh_mediaserver'] = sw('media.refresh_mediaserver')
  form['media.nfo_poster'] = sw('media.nfo_poster')

  const svcKeys = ['pt.ptsignin_cron', 'pt.pt_check_interval', 'pt.search_rss_interval',
    'media.mediasync_interval', 'pt.pt_monitor', 'pt.pt_monitor_only',
    'pt.search_auto', 'pt.search_no_result_rss']
  svcKeys.forEach(k => (form[k] = str(k)))
  form['pt.pt_monitor'] = sw('pt.pt_monitor')
  form['pt.pt_monitor_only'] = sw('pt.pt_monitor_only')
  form['pt.search_auto'] = sw('pt.search_auto')
  form['pt.search_no_result_rss'] = sw('pt.search_no_result_rss')

  const secKeys = ['security.media_server_webhook_allow_ip.ipv4',
    'security.media_server_webhook_allow_ip.ipv6',
    'security.telegram_webhook_allow_ip.ipv4',
    'security.telegram_webhook_allow_ip.ipv6',
    'security.synology_webhook_allow_ip.ipv4',
    'security.synology_webhook_allow_ip.ipv6',
    'security.api_key']
  secKeys.forEach(k => (form[k] = str(k)))

  const labKeys = ['laboratory.search_keyword', 'laboratory.search_tmdbweb',
    'laboratory.tmdb_cache_expire', 'laboratory.use_douban_titles',
    'laboratory.search_en_title', 'laboratory.tmdb_proxy']
  labKeys.forEach(k => (form[k] = sw(k)))
  releaseGroups.value = str('laboratory.release_groups')
}

async function loadData() {
  await load()
  syncForm()
}

async function saveKeys(keys: string[]) {
  const items: Record<string, unknown> = {}
  keys.forEach(k => { items[k] = form[k] })
  const ok = await save(items)
  return ok
}

function openReleaseGroups() {
  releaseGroups.value = String(form['laboratory.release_groups'] || getCfg('laboratory.release_groups') || '')
  releaseGroupsVisible.value = true
}

async function saveReleaseGroups() {
  const val = releaseGroups.value.replace(/;$/g, '')
  form['laboratory.release_groups'] = val
  const ok = await save({ 'laboratory.release_groups': val })
  if (ok) releaseGroupsVisible.value = false
}

onMounted(loadData)
</script>

<template>
  <div class="basic page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />

    <van-tabs v-else v-model:active="activeTab" sticky>
      <!-- 系统 -->
      <van-tab title="系统" name="system">
        <van-cell-group inset style="margin:12px 12px 0">
          <van-field :model-value="optionLabel(LOG_TYPES, form['app.logtype'])" label="日志类型" readonly is-link placeholder="请选择" @click="openPicker('日志类型', 'app.logtype', LOG_TYPES)" />
          <van-field v-model="form['app.logpath']" label="日志文件路径" placeholder="/config/logs" clearable />
          <van-field v-model="form['app.logserver']" label="日志中心地址" placeholder="127.0.0.1:514" clearable />
          <van-field :model-value="optionLabel(LOG_LEVELS, form['app.loglevel'])" label="日志级别" readonly is-link placeholder="请选择" @click="openPicker('日志级别', 'app.loglevel', LOG_LEVELS)" />
          <van-field :model-value="optionLabel(WALLPAPER_OPTIONS, form['app.wallpaper'])" label="WEB壁纸来源" readonly is-link placeholder="请选择" @click="openPicker('WEB壁纸来源', 'app.wallpaper', WALLPAPER_OPTIONS)" />
          <van-field v-model="form['app.web_port']" label="WEB服务端口" placeholder="3000" type="number" clearable />
          <van-field v-model="form['app.login_user']" label="WEB管理用户" placeholder="admin" clearable />
          <van-field v-model="form['app.login_password']" label="WEB管理密码" placeholder="password" type="password" clearable />
          <van-field v-model="form['app.ssl_cert']" label="HTTPS证书路径" placeholder="pem格式证书" clearable />
          <van-field v-model="form['app.ssl_key']" label="HTTPS密钥路径" placeholder="密钥文件路径" clearable />
          <van-field v-model="form['app.proxies']" label="代理服务器" placeholder="127.0.0.1:7890" clearable />
          <van-field v-model="form['app.domain']" label="外网访问地址" placeholder="http://IP:PORT" clearable />
          <van-field v-model="form['app.user_agent']" label="User-Agent" placeholder="Mozilla/5.0..." clearable />
        </van-cell-group>
        <div class="btn-area">
          <van-button block type="primary" :loading="saving" @click="saveKeys(['app.logtype','app.logpath','app.logserver','app.loglevel','app.wallpaper','app.web_port','app.login_user','app.login_password','app.ssl_cert','app.ssl_key','app.proxies','app.domain','app.user_agent'])">保存系统设置</van-button>
        </div>
      </van-tab>

      <!-- 媒体 -->
      <van-tab title="媒体" name="media">
        <van-cell-group inset style="margin:12px 12px 0">
          <van-field v-model="form['app.rmt_tmdbkey']" label="TMDB API Key" placeholder="支持多个key用;分隔" clearable />
          <van-field :model-value="optionLabel(TMDB_DOMAINS, form['app.tmdb_domain'])" label="TMDB域名" readonly is-link placeholder="请选择" @click="openPicker('TMDB域名', 'app.tmdb_domain', TMDB_DOMAINS)" />
          <van-field :model-value="optionLabel(MATCH_MODES, form['app.rmt_match_mode'])" label="TMDB匹配模式" readonly is-link placeholder="请选择" @click="openPicker('TMDB匹配模式', 'app.rmt_match_mode', MATCH_MODES)" />
          <van-field v-model="form['media.category']" label="二级分类策略" placeholder="default-category" clearable />
          <van-field :model-value="optionLabel(RMT_MODES, form['pt.rmt_mode'])" label="默认文件转移方式" readonly is-link placeholder="请选择" @click="openPicker('默认文件转移方式', 'pt.rmt_mode', RMT_MODES)" />
          <van-field v-model="form['media.min_filesize']" label="最小文件大小(MB)" placeholder="200" type="number" clearable />
          <van-field v-model="form['media.ignored_paths']" label="路径忽略词" placeholder="正则，;分隔" clearable />
          <van-field v-model="form['media.ignored_files']" label="文件名忽略词" placeholder="正则，;分隔" clearable />
          <van-field :model-value="optionLabel(DOWNLOAD_ORDERS, form['pt.download_order'])" label="下载优先规则" readonly is-link placeholder="请选择" @click="openPicker('下载优先规则', 'pt.download_order', DOWNLOAD_ORDERS)" />
          <van-field v-model="form['media.movie_name_format']" label="电影重命名格式" placeholder="{title} ({year})..." clearable />
          <van-field v-model="form['media.tv_name_format']" label="电视剧重命名格式" placeholder="{title} ({year})/Season {season}..." clearable />
          <van-field label="高质量文件覆盖">
            <template #input><van-switch v-model="form['media.filesize_cover']" /></template>
          </van-field>
          <van-field label="实时刷新媒体库">
            <template #input><van-switch v-model="form['media.refresh_mediaserver']" /></template>
          </van-field>
          <van-field label="刮削元数据及图片">
            <template #input><van-switch v-model="form['media.nfo_poster']" /></template>
          </van-field>
        </van-cell-group>
        <div class="btn-area">
          <van-button block @click="openReleaseGroups">自定义制作组/字幕组</van-button>
          <van-button block type="primary" :loading="saving" @click="saveKeys(['app.rmt_tmdbkey','app.tmdb_domain','app.rmt_match_mode','media.category','pt.rmt_mode','media.min_filesize','media.ignored_paths','media.ignored_files','pt.download_order','media.movie_name_format','media.tv_name_format','media.filesize_cover','media.refresh_mediaserver','media.nfo_poster'])">保存媒体设置</van-button>
        </div>
      </van-tab>

      <!-- 服务 -->
      <van-tab title="服务" name="service">
        <van-cell-group inset style="margin:12px 12px 0">
          <van-field v-model="form['pt.ptsignin_cron']" label="站点签到时间" placeholder="留空关闭自动签到" clearable />
          <van-field v-model="form['pt.pt_check_interval']" label="订阅RSS周期(秒)" placeholder="最小300秒" type="number" clearable />
          <van-field v-model="form['pt.search_rss_interval']" label="订阅搜索周期(小时)" placeholder="最小6小时" type="number" clearable />
          <van-field v-model="form['media.mediasync_interval']" label="媒体库同步周期(小时)" placeholder="留空关闭" type="number" clearable />
          <van-field label="下载软件监控">
            <template #input><van-switch v-model="form['pt.pt_monitor']" /></template>
          </van-field>
          <van-field label="只管理NAStool下载">
            <template #input><van-switch v-model="form['pt.pt_monitor_only']" /></template>
          </van-field>
          <van-field label="远程搜索自动择优下载">
            <template #input><van-switch v-model="form['pt.search_auto']" /></template>
          </van-field>
          <van-field label="下载不完整自动订阅">
            <template #input><van-switch v-model="form['pt.search_no_result_rss']" /></template>
          </van-field>
        </van-cell-group>
        <div class="btn-area">
          <van-button block type="primary" :loading="saving" @click="saveKeys(['pt.ptsignin_cron','pt.pt_check_interval','pt.search_rss_interval','media.mediasync_interval','pt.pt_monitor','pt.pt_monitor_only','pt.search_auto','pt.search_no_result_rss'])">保存服务设置</van-button>
        </div>
      </van-tab>

      <!-- 安全 -->
      <van-tab title="安全" name="security">
        <van-cell-group inset style="margin:12px 12px 0">
          <van-field v-model="form['security.media_server_webhook_allow_ip.ipv4']" label="媒体Webhook IPv4" placeholder="0.0.0.0/0" clearable />
          <van-field v-model="form['security.media_server_webhook_allow_ip.ipv6']" label="媒体Webhook IPv6" placeholder="::/0" clearable />
          <van-field v-model="form['security.telegram_webhook_allow_ip.ipv4']" label="Telegram IPv4" placeholder="0.0.0.0/0" clearable />
          <van-field v-model="form['security.telegram_webhook_allow_ip.ipv6']" label="Telegram IPv6" placeholder="::/0" clearable />
          <van-field v-model="form['security.synology_webhook_allow_ip.ipv4']" label="Synology IPv4" placeholder="0.0.0.0/0" clearable />
          <van-field v-model="form['security.synology_webhook_allow_ip.ipv6']" label="Synology IPv6" placeholder="::/0" clearable />
          <van-field v-model="form['security.api_key']" label="API密钥" placeholder="Jellyseerr/Overseerr调用" clearable />
        </van-cell-group>
        <div class="btn-area">
          <van-button block type="primary" :loading="saving" @click="saveKeys(['security.media_server_webhook_allow_ip.ipv4','security.media_server_webhook_allow_ip.ipv6','security.telegram_webhook_allow_ip.ipv4','security.telegram_webhook_allow_ip.ipv6','security.synology_webhook_allow_ip.ipv4','security.synology_webhook_allow_ip.ipv6','security.api_key'])">保存安全设置</van-button>
        </div>
      </van-tab>

      <!-- 实验室 -->
      <van-tab title="实验室" name="lab">
        <van-cell-group inset style="margin:12px 12px 0">
          <van-field label="辅助识别">
            <template #input><van-switch v-model="form['laboratory.search_keyword']" /></template>
          </van-field>
          <van-field label="增强识别">
            <template #input><van-switch v-model="form['laboratory.search_tmdbweb']" /></template>
          </van-field>
          <van-field label="TMDB缓存过期策略">
            <template #input><van-switch v-model="form['laboratory.tmdb_cache_expire']" /></template>
          </van-field>
          <van-field label="使用豆瓣名称联想">
            <template #input><van-switch v-model="form['laboratory.use_douban_titles']" /></template>
          </van-field>
          <van-field label="搜索优先英文名">
            <template #input><van-switch v-model="form['laboratory.search_en_title']" /></template>
          </van-field>
          <van-field label="使用TMDB代理服务">
            <template #input><van-switch v-model="form['laboratory.tmdb_proxy']" /></template>
          </van-field>
        </van-cell-group>
        <div class="btn-area">
          <van-button block type="primary" :loading="saving" @click="saveKeys(['laboratory.search_keyword','laboratory.search_tmdbweb','laboratory.tmdb_cache_expire','laboratory.use_douban_titles','laboratory.search_en_title','laboratory.tmdb_proxy'])">保存实验室设置</van-button>
        </div>
      </van-tab>
    </van-tabs>

    <!-- 通用选项选择器 -->
    <van-popup v-model:show="pickerVisible" position="bottom" round teleport="body">
      <van-picker
        v-model="pickerValue"
        :title="pickerTitle"
        :columns="pickerColumns"
        @confirm="onPickerConfirm"
        @cancel="pickerVisible = false"
      />
    </van-popup>

    <!-- 自定义制作组/字幕组 -->
    <van-popup v-model:show="releaseGroupsVisible" position="center" round :style="{ width: '85%' }" closeable title="自定义制作组/字幕组">
      <van-form @submit="saveReleaseGroups" style="padding:16px">
        <div class="tip">多个制作组/字幕组请用;分隔，支持正则表达式，特殊字符注意转义</div>
        <van-field v-model="releaseGroups" type="textarea" rows="6" autosize placeholder="请输入制作组/字幕组" />
        <div style="margin-top:16px"><van-button block type="primary" native-type="submit" :loading="saving">保存</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>

<style scoped>
/* 设置项标题不换行 */
.basic :deep(.van-field__label) {
  width: auto;
  white-space: nowrap;
  margin-right: 16px;
}

.btn-area {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tip {
  font-size: 12px;
  color: #969799;
  line-height: 1.5;
  margin-bottom: 12px;
}
</style>
