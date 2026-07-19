<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showDialog, showLoadingToast, closeToast } from 'vant'
import { doAction } from '@/api/request'
import {
  getUserRssTasks,
  getUserRssTaskDetail,
  updateUserRssTask,
  deleteUserRssTask,
  runUserRss,
  listRssArticles,
  rssArticlesDownload,
  rssArticlesCheck,
  rssArticleTest,
  listRssHistory,
  getRssParserList,
  getRssSites,
  getIndexers,
  type RssSiteItem,
  type IndexerItem,
  type UserRssTask,
  type UserRssArticle,
  type UserRssHistory,
  type UpdateUserRssTaskParams,
  type RssParser
} from '@/api/rss'
import { getDownloadSettings } from '@/api/download'
import type { DownloadSettingOption } from '@/api/download'

const router = useRouter()

const loading = ref(false)
const list = ref<UserRssTask[]>([])
const parsers = ref<RssParser[]>([])
const rssSites = ref<RssSiteItem[]>([])
const searchSites = ref<IndexerItem[]>([])
const ruleGroups = ref<Array<{ id: number | string; name: string }>>([])
const downloadSettings = ref<DownloadSettingOption[]>([])

const RESTYPE_OPTIONS = ['BLURAY', 'REMUX', 'DOLBY', 'WEB', 'HDTV', 'UHD', 'HDR', '3D']
const PIX_OPTIONS = ['8k', '4k', '1080p', '720p']

onMounted(() => { load(); loadOptions() })

async function load() {
  loading.value = true
  try {
    const res = await getUserRssTasks()
    if (res.code === 0) {
      const detail = res.detail
      list.value = Array.isArray(detail) ? detail : detail ? [detail] : []
    }
  } catch { showToast('获取订阅任务失败') }
  finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [parserRes, ruleRes, dsRes, rssRes, idxRes] = await Promise.all([
      getRssParserList(),
      doAction<{ code: number; ruleGroups?: Array<{ id: number; name: string }> }>('get_filterrules', {}),
      getDownloadSettings(),
      getRssSites(),
      getIndexers()
    ])
    if (parserRes.code === 0) parsers.value = parserRes.detail || []
    if (ruleRes.code === 0) ruleGroups.value = ruleRes.ruleGroups || []
    if (dsRes.code === 0) downloadSettings.value = dsRes.data || []
    if (rssRes.code === 0) rssSites.value = rssRes.sites || []
    if (idxRes.code === 0) searchSites.value = idxRes.indexers || []
  } catch { /* ignore */ }
}

const expandedIds = ref<Set<number>>(new Set())
function toggleDetail(id: number) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else expandedIds.value.add(id)
}

async function onRun(row: UserRssTask) {
  try {
    const res = await runUserRss(row.id)
    if (res.code === 0) { showToast('任务运行完成'); load() }
    else showToast(res.msg || '运行失败')
  } catch { showToast('运行失败') }
}

async function onDelete(row: UserRssTask) {
  const ok = await showConfirmDialog({ title: '删除任务', message: `确认删除「${row.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await deleteUserRssTask(row.id)
    if (res.code === 0) { showToast('删除成功'); load() }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}

function addressOnly(addr?: string) {
  if (!addr) return ''
  return addr.split('?')[0]
}

// ---- Add/Edit Dialog ----
const dialogVisible = ref(false)
const dialogTitle = ref('新增订阅')
const submitting = ref(false)

const rssSitesSelected = ref<string[]>([])
const searchSitesSelected = ref<string[]>([])

const form = ref({
  id: '' as string | number,
  name: '',
  state: 'N',
  interval: '' as string | number,
  address: '',
  parser: '' as string | number,
  uses: 'D' as 'D' | 'R',
  include: '',
  exclude: '',
  rule: '' as string | number,
  save_path: '',
  download_setting: '' as string | number,
  recognization: 'Y',
  restype: '',
  pix: '',
  team: '',
  over_edition: '0',
  rss_sites: [] as Array<string | number>,
  search_sites: [] as Array<string | number>
})

function resetForm() {
  form.value = {
    id: '', name: '', state: 'N', interval: '', address: '',
    parser: parsers.value[0]?.id ?? '', uses: 'D',
    include: '', exclude: '', rule: '', save_path: '',
    download_setting: '', recognization: 'Y',
    restype: '', pix: '', team: '', over_edition: '0',
    rss_sites: [], search_sites: []
  }
  rssSitesSelected.value = rssSites.value.map(s => s.name)
  searchSitesSelected.value = searchSites.value.map(s => s.name)
}

function openAdd() {
  resetForm()
  dialogTitle.value = '新增订阅'
  dialogVisible.value = true
}

async function openEdit(row: UserRssTask) {
  try {
    const res = await getUserRssTaskDetail(row.id)
    if (res.code !== 0) { showToast('获取任务详情失败'); return }
    const d = res.detail as UserRssTask
    resetForm()
    const f = form.value
    f.id = d.id
    f.name = d.name
    f.state = d.state || 'N'
    f.interval = d.interval ?? ''
    f.address = d.address || ''
    f.parser = d.parser ?? ''
    f.uses = (d.uses as 'D' | 'R') || 'D'
    f.include = d.include || ''
    f.exclude = d.exclude || ''
    f.rule = d.filter ?? ''
    f.save_path = d.save_path || ''
    f.download_setting = d.download_setting ?? ''
    f.recognization = d.recognization || 'Y'
    f.over_edition = String(d.over_edition ?? '0')
    const fargs = d.filter_args || {}
    f.restype = fargs.restype || ''
    f.pix = fargs.pix || ''
    f.team = fargs.team || ''
    const sites = d.sites || { rss_sites: [], search_sites: [] }
    f.rss_sites = sites.rss_sites || []
    f.search_sites = sites.search_sites || []
    rssSitesSelected.value = (sites.rss_sites as string[])?.length ? (sites.rss_sites as string[]) : rssSites.value.map(s => s.name)
    searchSitesSelected.value = (sites.search_sites as string[])?.length ? (sites.search_sites as string[]) : searchSites.value.map(s => s.name)
    dialogTitle.value = '编辑订阅'
    dialogVisible.value = true
  } catch { showToast('获取任务详情失败') }
}

async function submit() {
  const f = form.value
  if (!f.name) { showToast('请输入名称'); return }
  if (!f.interval || isNaN(Number(f.interval))) { showToast('请输入有效的刷新间隔'); return }
  if (!f.address) { showToast('请输入RSS地址'); return }
  if (!f.parser) { showToast('请选择解析器'); return }

  const params: UpdateUserRssTaskParams = {
    id: f.id || undefined,
    name: f.name,
    address: f.address,
    parser: f.parser,
    interval: f.interval,
    uses: f.uses,
    state: f.state,
    include: f.include,
    exclude: f.exclude,
    rule: f.rule,
    save_path: f.save_path,
    download_setting: f.download_setting
  }
  if (f.uses === 'D') {
    params.recognization = f.recognization
  } else {
    const allRss = rssSitesSelected.value.length === rssSites.value.length
    const allSearch = searchSitesSelected.value.length === searchSites.value.length
    params.over_edition = f.over_edition
    params.sites = { rss_sites: allRss ? [] : rssSitesSelected.value, search_sites: allSearch ? [] : searchSitesSelected.value }
    params.restype = f.restype
    params.pix = f.pix
    params.team = f.team
  }
  submitting.value = true
  try {
    const res = await updateUserRssTask(params)
    if (res.code === 0) {
      showToast(f.id ? '保存成功' : '新增成功')
      dialogVisible.value = false
      load()
    } else { showToast(res.msg || '保存失败') }
  } catch { showToast('保存失败') }
  finally { submitting.value = false }
}

// ---- Articles Preview ----
const articlesDialogVisible = ref(false)
const articlesLoading = ref(false)
const articlesList = ref<UserRssArticle[]>([])
const articlesUses = ref('D')
const articlesTaskId = ref<string | number>('')
const articlesTitle = ref('订阅预览')
const selectedArticles = ref<UserRssArticle[]>([])

async function openArticles(row: UserRssTask) {
  articlesTitle.value = `订阅预览 - ${row.name}`
  articlesTaskId.value = row.id
  articlesDialogVisible.value = true
  articlesLoading.value = true
  articlesList.value = []
  selectedArticles.value = []
  try {
    const res = await listRssArticles(row.id)
    if (res.code === 0) {
      articlesList.value = res.data || []
      articlesUses.value = res.uses || 'D'
    } else { showToast(res.msg || '未获取到报文') }
  } catch { showToast('获取报文失败') }
  finally { articlesLoading.value = false }
}

function toggleArticle(a: UserRssArticle) {
  const idx = selectedArticles.value.findIndex(x => x.title === a.title)
  if (idx >= 0) selectedArticles.value.splice(idx, 1)
  else selectedArticles.value.push(a)
}

function isSelected(a: UserRssArticle) {
  return selectedArticles.value.some(x => x.title === a.title)
}

async function batchDownload() {
  if (selectedArticles.value.length === 0) { showToast('请先选择文章'); return }
  const articles = selectedArticles.value.map(a => ({ title: a.title, enclosure: a.enclosure || '' }))
  try {
    const res = await rssArticlesDownload(articlesTaskId.value, articles)
    if (res.code === 0) showToast('添加下载成功')
    else showToast('添加下载失败')
    openArticles({ id: articlesTaskId.value, name: '' } as UserRssTask)
  } catch { showToast('下载失败') }
}

async function batchCheck(flag: 'set_finished' | 'set_unfinish') {
  if (selectedArticles.value.length === 0) { showToast('请先选择文章'); return }
  const articles = selectedArticles.value.map(a => ({ title: a.title, enclosure: a.enclosure || '' }))
  try {
    const res = await rssArticlesCheck(flag, articles)
    if (res.code === 0) { showToast('处理成功'); openArticles({ id: articlesTaskId.value, name: '' } as UserRssTask) }
    else showToast('处理失败')
  } catch { showToast('处理失败') }
}

async function singleDownload(article: UserRssArticle) {
  try {
    const res = await rssArticlesDownload(articlesTaskId.value, [{ title: article.title, enclosure: article.enclosure || '' }])
    if (res.code === 0) showToast('添加下载成功')
    else showToast('添加下载失败')
    openArticles({ id: articlesTaskId.value, name: '' } as UserRssTask)
  } catch { showToast('下载失败') }
}

async function testArticle(article: UserRssArticle) {
  try {
    const res = await rssArticleTest(articlesTaskId.value, article.title)
    if (res.code === 0 && res.data) {
      const data = res.data
      const name = (data.name as string) || (data.title as string) || '无法识别'
      const parts: string[] = [name]
      if (data.match_flag) parts.push('匹配'); else parts.push('不匹配')
      if (data.exist_flag) parts.push('本地已存在'); else parts.push('本地不存在')
      showDialog({ title: '识别结果', message: parts.join(' / ') })
    } else { showToast('无法识别') }
  } catch { showToast('测试失败') }
}

// ---- History ----
const historyDialogVisible = ref(false)
const historyLoading = ref(false)
const historyList = ref<UserRssHistory[]>([])
const historyTitle = ref('订阅下载历史')

async function openHistory(row: UserRssTask) {
  historyTitle.value = `订阅下载历史 - ${row.name}`
  historyDialogVisible.value = true
  historyLoading.value = true
  historyList.value = []
  try {
    const res = await listRssHistory(row.id)
    if (res.code === 0) historyList.value = res.data || []
    else showToast(res.msg || '无下载记录')
  } catch { showToast('获取历史失败') }
  finally { historyLoading.value = false }
}

function goParser() {
  router.push('/rss_parser')
}
</script>

<template>
  <div class="user-rss page">
    <!-- Header -->
    <div class="page-header">
      <span class="page-title">自定义订阅</span>
      <div class="header-actions">
        <van-button size="small" plain @click="goParser">解析器</van-button>
        <van-button size="small" type="primary" icon="plus" @click="openAdd">新建</van-button>
      </div>
    </div>

    <van-loading v-if="loading && list.length === 0" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="list.length === 0" description="暂无自定义订阅任务" />

    <div v-else class="task-list">
      <div v-for="item in list" :key="item.id" class="task-card">
        <!-- Card Header -->
        <div class="card-header" @click="toggleDetail(item.id)">
          <span class="status-dot" :class="item.state === 'R' ? 'dot-run' : item.state === 'P' ? 'dot-pause' : 'dot-stop'" />
          <span class="task-name">{{ item.name }}</span>
          <van-tag v-if="item.state === 'R'" size="small" type="success">运行中</van-tag>
          <van-tag v-else-if="item.state === 'P'" size="small" type="warning">已暂停</van-tag>
          <van-tag v-else size="small" type="danger">停止</van-tag>
          <van-icon :name="expandedIds.has(item.id) ? 'arrow-up' : 'arrow-down'" class="expand-icon" />
        </div>

        <!-- Collapsible Detail -->
        <div v-if="expandedIds.has(item.id)" class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">RSS地址</span>
              <span class="info-value" :title="item.address">{{ addressOnly(item.address) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">解析器</span>
              <span class="info-value">{{ item.parser_name || item.parser }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">间隔</span>
              <span class="info-value">{{ item.interval }} 分钟</span>
            </div>
            <div class="info-item">
              <span class="info-label">类型</span>
              <van-tag :type="item.uses === 'D' ? 'primary' : 'warning'" size="small">
                {{ item.uses === 'D' ? '下载' : '订阅' }}
              </van-tag>
            </div>
          </div>

          <div class="detail-rows">
            <div v-if="item.include" class="detail-row">
              <span class="dl-label">包含</span><span class="dl-value">{{ item.include }}</span>
            </div>
            <div v-if="item.exclude" class="detail-row">
              <span class="dl-label">排除</span><span class="dl-value">{{ item.exclude }}</span>
            </div>
            <div v-if="item.filter_name" class="detail-row">
              <span class="dl-label">规则</span><span class="dl-value">{{ item.filter_name }}</span>
            </div>
            <div v-if="item.save_path" class="detail-row">
              <span class="dl-label">保存路径</span><span class="dl-value">{{ item.save_path }}</span>
            </div>
          </div>

          <div class="badges-row">
            <van-tag v-if="item.filter_args?.restype" size="small" plain>质量: {{ item.filter_args.restype }}</van-tag>
            <van-tag v-if="item.filter_args?.pix" size="small" plain>分辨率: {{ item.filter_args.pix }}</van-tag>
            <van-tag v-if="item.filter_args?.team" size="small" plain>制作组: {{ item.filter_args.team }}</van-tag>
            <van-tag v-if="item.over_edition && item.over_edition !== '0'" size="small" plain type="warning">洗版</van-tag>
          </div>

          <div class="counter-row" v-if="item.counter !== undefined">
            <span class="counter-link" @click.stop="openHistory(item)">处理量: {{ item.counter }}</span>
            <span v-if="item.update_time" class="update-time">{{ item.update_time }}</span>
          </div>

          <div class="card-actions">
            <van-button size="small" plain type="primary" icon="bolt" @click.stop="onRun(item)">运行</van-button>
            <van-button size="small" plain icon="eye-o" @click.stop="openArticles(item)">预览</van-button>
            <van-button size="small" plain icon="edit" @click.stop="openEdit(item)">编辑</van-button>
            <van-button size="small" plain type="danger" icon="delete" @click.stop="onDelete(item)">删除</van-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <van-popup v-model:show="dialogVisible" position="bottom" round :style="{ height: '92%' }">
      <div class="form-container">
        <div class="form-header">
          <span>{{ dialogTitle }}</span>
          <van-icon name="close" @click="dialogVisible = false" />
        </div>
        <van-form @submit="submit">
          <van-cell-group inset>
            <van-field v-model="form.name" label="名称" placeholder="任务名称" clearable
              :rules="[{ required: true, message: '请输入名称' }]" />
            <van-field label="状态">
              <template #input>
                <van-radio-group v-model="form.state" direction="horizontal">
                  <van-radio name="N" shape="square">正常</van-radio>
                  <van-radio name="P" shape="square">停用</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field v-model="form.interval" label="刷新间隔" placeholder="分钟" type="number" clearable
              :rules="[{ required: true, message: '请输入间隔' }]" />
            <van-field v-model="form.address" label="RSS地址" placeholder="https://..." clearable
              :rules="[{ required: true, message: '请输入RSS地址' }]" />
            <van-field label="解析器">
              <template #input>
                <van-radio-group v-model="form.parser" direction="horizontal">
                  <van-radio v-for="p in parsers" :key="String(p.id)" :name="p.id" shape="square">{{ p.name }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field label="使用方式">
              <template #input>
                <van-radio-group v-model="form.uses" direction="horizontal">
                  <van-radio name="D" shape="square">下载</van-radio>
                  <van-radio name="R" shape="square">订阅</van-radio>
                </van-radio-group>
              </template>
            </van-field>
          </van-cell-group>

          <div class="section-title">过滤条件</div>
          <van-cell-group inset>
            <van-field v-model="form.include" label="包含" placeholder="关键词" clearable />
            <van-field v-model="form.exclude" label="排除" placeholder="关键词" clearable />
            <van-field label="过滤规则">
              <template #input>
                <van-radio-group v-model="form.rule" direction="horizontal">
                  <van-radio name="" shape="square">不限</van-radio>
                  <van-radio v-for="g in ruleGroups" :key="String(g.id)" :name="g.id" shape="square">{{ g.name }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>
          </van-cell-group>

          <div class="section-title">下载设置</div>
          <van-cell-group inset>
            <van-field label="下载设置">
              <template #input>
                <van-radio-group v-model="form.download_setting" direction="horizontal">
                  <van-radio name="" shape="square">默认</van-radio>
                  <van-radio v-for="ds in downloadSettings" :key="String(ds.id)" :name="ds.id" shape="square">{{ ds.name }}</van-radio>
                </van-radio-group>
              </template>
            </van-field>
            <van-field v-model="form.save_path" label="保存路径" placeholder="留空使用默认" clearable />
            <van-field v-if="form.uses === 'D'" label="识别">
              <template #input>
                <van-radio-group v-model="form.recognization" direction="horizontal">
                  <van-radio name="Y" shape="square">识别</van-radio>
                  <van-radio name="N" shape="square">不识别</van-radio>
                </van-radio-group>
              </template>
            </van-field>
          </van-cell-group>

          <!-- Subscribe-only fields -->
          <template v-if="form.uses === 'R'">
            <div class="section-title">订阅参数</div>
            <van-cell-group inset>
              <van-field label="洗版">
                <template #input>
                  <van-radio-group v-model="form.over_edition" direction="horizontal">
                    <van-radio name="0" shape="square">关闭</van-radio>
                    <van-radio name="1" shape="square">开启</van-radio>
                  </van-radio-group>
                </template>
              </van-field>
              <van-field label="质量">
                <template #input>
                  <van-radio-group v-model="form.restype" direction="horizontal" class="wrap-radio">
                    <van-radio name="" shape="square">不限</van-radio>
                    <van-radio v-for="r in RESTYPE_OPTIONS" :key="r" :name="r" shape="square">{{ r }}</van-radio>
                  </van-radio-group>
                </template>
              </van-field>
              <van-field label="分辨率">
                <template #input>
                  <van-radio-group v-model="form.pix" direction="horizontal" class="wrap-radio">
                    <van-radio name="" shape="square">不限</van-radio>
                    <van-radio v-for="p in PIX_OPTIONS" :key="p" :name="p" shape="square">{{ p }}</van-radio>
                  </van-radio-group>
                </template>
              </van-field>
              <van-field v-model="form.team" label="制作组" placeholder="如 SUBBIRD" clearable />
            </van-cell-group>

            <div class="section-title">RSS站点</div>
            <van-cell-group inset>
              <van-checkbox-group v-model="rssSitesSelected" direction="horizontal" class="site-checkboxes">
                <van-checkbox v-for="s in rssSites" :key="s.name" :name="s.name" shape="square">{{ s.name }}</van-checkbox>
              </van-checkbox-group>
            </van-cell-group>

            <div class="section-title">搜索站点</div>
            <van-cell-group inset>
              <van-checkbox-group v-model="searchSitesSelected" direction="horizontal" class="site-checkboxes">
                <van-checkbox v-for="s in searchSites" :key="s.name" :name="s.name" shape="square">{{ s.name }}</van-checkbox>
              </van-checkbox-group>
            </van-cell-group>
          </template>

          <div style="padding:16px;margin-bottom:20px">
            <van-button block type="primary" native-type="submit" :loading="submitting">
              {{ form.id ? '保存修改' : '新增任务' }}
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- Articles Preview Dialog -->
    <van-popup v-model:show="articlesDialogVisible" position="bottom" round :style="{ height: '80%' }">
      <div class="form-container">
        <div class="form-header">
          <span>{{ articlesTitle }}</span>
          <van-icon name="close" @click="articlesDialogVisible = false" />
        </div>
        <div class="batch-bar">
          <van-button size="small" plain type="primary" @click="batchDownload">批量下载</van-button>
          <van-button size="small" plain @click="batchCheck('set_finished')">标为完成</van-button>
          <van-button size="small" plain @click="batchCheck('set_unfinish')">标为未完成</van-button>
        </div>
        <van-loading v-if="articlesLoading" size="20" style="padding:40px;text-align:center" />
        <div v-else class="articles-list">
          <div v-for="(a, i) in articlesList" :key="i" class="article-row" :class="{ 'article-selected': isSelected(a) }" @click="toggleArticle(a)">
            <div class="article-body">
              <div class="article-title">{{ a.title }}</div>
              <div class="article-meta">
                <span v-if="a.size" class="meta-text">{{ a.size }}</span>
                <span v-if="a.date" class="meta-text">{{ a.date }}</span>
                <van-tag v-if="a.finish_flag" size="small" type="success">已处理</van-tag>
                <van-tag v-else size="small" type="info">未处理</van-tag>
              </div>
            </div>
            <div class="article-actions" @click.stop>
              <van-icon name="eye-o" class="action-icon" title="测试识别" @click="testArticle(a)" />
              <van-icon name="download-o" class="action-icon" title="下载" @click="singleDownload(a)" />
            </div>
          </div>
          <van-empty v-if="articlesList.length === 0" description="暂无报文" />
        </div>
      </div>
    </van-popup>

    <!-- History Dialog -->
    <van-popup v-model:show="historyDialogVisible" position="bottom" round :style="{ height: '60%' }">
      <div class="form-container">
        <div class="form-header">
          <span>{{ historyTitle }}</span>
          <van-icon name="close" @click="historyDialogVisible = false" />
        </div>
        <van-loading v-if="historyLoading" size="20" style="padding:40px;text-align:center" />
        <div v-else class="history-list">
          <div v-for="(h, i) in historyList" :key="i" class="history-row">
            <div class="history-title">{{ h.title }}</div>
            <div class="history-meta">
              <van-tag v-if="h.downloader" size="small" plain type="primary">{{ h.downloader }}</van-tag>
              <span class="meta-text">{{ h.date }}</span>
            </div>
          </div>
          <van-empty v-if="historyList.length === 0" description="暂无下载记录" />
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.task-list {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.task-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  overflow: hidden;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-run { background: #07c160; }
.dot-pause { background: #ff976a; }
.dot-stop { background: #c8c9cc; }
.task-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expand-icon {
  font-size: 16px;
  color: #c8c9cc;
  flex-shrink: 0;
}
.card-body {
  padding: 0 12px 12px;
  border-top: 1px solid #f5f5f5;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  padding: 10px 0;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  min-width: 0;
}
.info-label { color: #969799; flex-shrink: 0; }
.info-value { color: #323233; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 8px;
}
.detail-row {
  display: flex;
  font-size: 12px;
  gap: 6px;
}
.dl-label { color: #969799; flex-shrink: 0; }
.dl-value { color: #646566; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 8px;
}
.counter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding-bottom: 8px;
}
.counter-link {
  color: var(--van-primary-color);
  cursor: pointer;
}
.update-time {
  color: #969799;
}
.card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid #f5f5f5;
}

/* Form */
.form-container {
  height: 100%;
  overflow-y: auto;
}
.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.form-header .van-icon {
  font-size: 20px;
  color: #969799;
  cursor: pointer;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
  padding: 12px 16px 6px;
}
.wrap-radio {
  flex-wrap: wrap;
  gap: 6px;
}
.site-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 8px 12px;
}

/* Articles */
.batch-bar {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
  flex-wrap: wrap;
}
.articles-list {
  padding: 0 16px 12px;
}
.article-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
}
.article-selected {
  background: var(--van-primary-color-light, #f0f5ff);
  margin: 0 -8px;
  padding: 10px 8px;
  border-radius: 4px;
}
.article-body {
  flex: 1;
  min-width: 0;
}
.article-title {
  font-size: 13px;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.article-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  flex-wrap: wrap;
}
.article-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
.action-icon {
  font-size: 18px;
  color: #646566;
  cursor: pointer;
}

/* History */
.history-list {
  padding: 0 16px 12px;
}
.history-row {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.history-title {
  font-size: 13px;
  color: #323233;
}
.history-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}
</style>
