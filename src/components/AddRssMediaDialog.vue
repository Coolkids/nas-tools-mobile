<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { showToast } from 'vant'
import HelpTip from '@/components/HelpTip.vue'
import { addRssMedia, getRssSites, getIndexers, getRssDetail, type AddRssMediaParams } from '@/api/rss'
import { getDownloadDirs, getDownloadSettings, type DownloadSettingOption } from '@/api/download'
import { doAction } from '@/api/request'

const props = defineProps<{
  modelValue: boolean
  type: 'MOV' | 'TV'
  rssid?: string | number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
  (e: 'error', msg: string): void
}>()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

const FORM_SEASONS = Array.from({ length: 50 }, (_, i) => ({ value: `${i + 1}`, label: `第${i + 1}季` }))
const RESTYPE_OPTIONS = ['BLURAY', 'REMUX', 'DOLBY', 'WEB', 'HDTV', 'UHD', 'HDR', '3D']
const PIX_OPTIONS = ['8k', '4k', '1080p', '720p']

const form = reactive({
  name: '', year: '', keyword: '', season: '', fuzzy_match: false, over_edition: false,
  total_ep: '', current_ep: '', filter_restype: '', filter_pix: '', filter_team: '',
  filter_rule: '' as string | number, download_setting: '' as string | number, save_path: ''
})

const rssSites = ref<string[]>([])
const searchSites = ref<string[]>([])
const rssSitesSelected = ref<string[]>([])
const searchSitesSelected = ref<string[]>([])
const downloadSettings = ref<DownloadSettingOption[]>([])
const savePaths = ref<string[]>([])
const ruleGroups = ref<Array<{ id: number | string; name: string }>>([])
const submitting = ref(false)
const activeStep = ref('basic')

const storageKey = computed(() => props.type === 'MOV' ? 'RssSettingMOV' : 'RssSettingTV')

watch(() => props.modelValue, async (open) => {
  if (!open) return
  resetForm()
  await loadOptions()
  if (props.rssid) await loadEditDetail()
  else await loadSaved()
})

async function loadEditDetail() {
  if (!props.rssid) return
  try {
    const res = await getRssDetail(props.rssid, props.type)
    if (res.code !== 0 || !res.detail) return
    const d = res.detail
    Object.assign(form, {
      name: d.name || '', year: d.year || '', keyword: d.keyword || '', season: d.season || '',
      fuzzy_match: !!d.fuzzy_match, over_edition: !!d.over_edition,
      total_ep: String(d.total_ep ?? ''), current_ep: String(d.current_ep ?? ''),
      filter_restype: d.filter_restype || '', filter_pix: d.filter_pix || '', filter_team: d.filter_team || '',
      filter_rule: d.filter_rule || '', download_setting: d.download_setting ?? ''
    })
    if (form.download_setting) await fetchSavePaths(form.download_setting)
    form.save_path = d.save_path || ''
    rssSitesSelected.value = d.rss_sites?.length ? d.rss_sites : [...rssSites.value]
    searchSitesSelected.value = d.search_sites?.length ? d.search_sites : [...searchSites.value]
  } catch { /* ignore */ }
}

function resetForm() {
  Object.assign(form, {
    name: '', year: '', keyword: '', season: '', fuzzy_match: false, over_edition: false,
    total_ep: '', current_ep: '', filter_restype: '', filter_pix: '', filter_team: '',
    filter_rule: '', download_setting: '', save_path: ''
  })
  rssSitesSelected.value = []
  searchSitesSelected.value = []
  savePaths.value = []
}

async function loadOptions() {
  try {
    const [rssRes, idxRes, dsRes, ruleRes] = await Promise.all([
      getRssSites(), getIndexers(), getDownloadSettings(),
      doAction<{ code: number; ruleGroups?: Array<{ id: number | string; name: string }> }>('get_filterrules', {})
    ])
    if (rssRes.code === 0) rssSites.value = (rssRes.sites || []).map(s => s.name)
    if (idxRes.code === 0) searchSites.value = (idxRes.indexers || []).map(s => s.name)
    if (dsRes.code === 0) downloadSettings.value = dsRes.data || []
    if (ruleRes.code === 0) ruleGroups.value = ruleRes.ruleGroups || []
  } catch { /* ignore */ }
}

async function loadSaved() {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return
    const saved = JSON.parse(raw)
    form.filter_restype = saved.filter_restype ?? ''
    form.filter_pix = saved.filter_pix ?? ''
    form.filter_team = saved.filter_team ?? ''
    form.filter_rule = saved.filter_rule ?? ''
    form.download_setting = saved.download_setting ?? ''
    if (form.download_setting) await fetchSavePaths(form.download_setting)
    form.save_path = saved.save_path ?? ''
    rssSitesSelected.value = saved.rss_sites?.length ? saved.rss_sites : [...rssSites.value]
    searchSitesSelected.value = saved.search_sites?.length ? saved.search_sites : [...searchSites.value]
  } catch { /* ignore */ }
}

async function fetchSavePaths(sid: string | number) {
  if (!sid) { savePaths.value = []; return }
  try { const res = await getDownloadDirs(sid); if (res.code === 0) savePaths.value = res.paths || [] }
  catch { savePaths.value = [] }
}

async function onDownloadSettingChange(val: string | number) {
  form.save_path = ''
  await fetchSavePaths(val)
}

async function submit(keepOpen = false) {
  if (!form.name) { emit('error', '请输入标题'); return }
  if (form.year && isNaN(Number(form.year))) { emit('error', '年份需为数字'); return }
  if (!form.fuzzy_match && !form.season && props.type === 'TV') { emit('error', '请选择季'); return }
  if (form.total_ep && isNaN(Number(form.total_ep))) { emit('error', '总集数需为数字'); return }
  if (form.current_ep && isNaN(Number(form.current_ep))) { emit('error', '开始订阅集数需为数字'); return }

  const allRss = rssSitesSelected.value.length === rssSites.value.length || !rssSitesSelected.value.length
  const allSearch = searchSitesSelected.value.length === searchSites.value.length || !searchSitesSelected.value.length

  localStorage.setItem(storageKey.value, JSON.stringify({
    filter_restype: form.filter_restype, filter_pix: form.filter_pix, filter_team: form.filter_team,
    filter_rule: form.filter_rule, save_path: form.save_path, download_setting: form.download_setting,
    rss_sites: allRss ? [] : rssSitesSelected.value, search_sites: allSearch ? [] : searchSitesSelected.value
  }))

  const params: AddRssMediaParams = {
    type: props.type, name: form.name, year: form.year, keyword: form.keyword, season: form.season,
    fuzzy_match: form.fuzzy_match, over_edition: form.over_edition,
    rss_sites: allRss ? [] : rssSitesSelected.value, search_sites: form.fuzzy_match ? [] : allSearch ? [] : searchSitesSelected.value,
    filter_restype: form.filter_restype, filter_pix: form.filter_pix, filter_team: form.filter_team,
    filter_rule: form.filter_rule, save_path: form.save_path, download_setting: form.download_setting
  }
  if (props.rssid) params.rssid = props.rssid
  if (props.type === 'TV') { params.total_ep = form.total_ep; params.current_ep = form.current_ep }

  submitting.value = true
  try {
    const res = await addRssMedia(params)
    if (res.code === 0) { emit('success'); if (!keepOpen) visible.value = false; else resetForm() }
    else emit('error', res.msg || '添加订阅失败')
  } catch (e) { emit('error', e instanceof Error ? e.message : '添加订阅失败') }
  finally { submitting.value = false }
}
</script>

<template>
  <van-popup v-model:show="visible" position="bottom" round :style="{ height: '85%' }" closeable :title="props.rssid ? '编辑订阅' : '新增订阅'">
    <div style="padding: 16px">
      <van-steps :active="activeStep === 'basic' ? 0 : 1">
        <van-step>基本信息</van-step>
        <van-step>订阅设置</van-step>
      </van-steps>

      <template v-if="activeStep === 'basic'">
        <van-form @submit="activeStep = 'setting'" style="margin-top: 12px">
          <van-field v-model="form.name" label="标题" placeholder="请输入标题" :rules="[{ required: true, message: '请输入标题' }]" />
          <van-field v-model="form.year" label="年份" placeholder="年份" />
          <van-field v-model="form.keyword" label="搜索词" placeholder="留空使用TMDB数据" />
          <van-field v-if="type === 'TV'" name="season" label="季" :rules="[{ required: !form.fuzzy_match, message: '请选择季' }]">
            <template #input>
              <van-picker :columns="FORM_SEASONS.map(s => s.label)" @confirm="(v: string, i: number) => form.season = FORM_SEASONS[i].value" />
              <van-tag v-if="form.season" type="primary" closable @close="form.season = ''">第{{ form.season }}季</van-tag>
            </template>
          </van-field>
          <van-field v-if="type === 'TV'" v-model="form.total_ep" label="总集数" placeholder="留空使用TMDB数据" />
          <van-field v-if="type === 'TV'" v-model="form.current_ep" label="开始集数" placeholder="开始订阅集数" />
          <van-field name="fuzzy_match" label="模糊匹配">
            <template #input><van-switch v-model="form.fuzzy_match" /></template>
          </van-field>
          <van-field name="over_edition" label="洗版">
            <template #input><van-switch v-model="form.over_edition" /></template>
          </van-field>
          <div style="margin-top: 16px">
            <van-button round block type="primary" native-type="submit">下一步</van-button>
          </div>
        </van-form>
      </template>

      <template v-else>
        <van-form @submit="submit()" style="margin-top: 12px">
          <van-field name="filter_restype" label="质量">
            <template #input>
              <van-radio-group v-model="form.filter_restype" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="r in RESTYPE_OPTIONS" :key="r" :name="r" shape="square">{{ r }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="filter_pix" label="分辨率">
            <template #input>
              <van-radio-group v-model="form.filter_pix" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="p in PIX_OPTIONS" :key="p" :name="p" shape="square">{{ p }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field v-model="form.filter_team" label="制作组" placeholder="支持正则" />
          <van-field name="filter_rule" label="过滤规则">
            <template #input>
              <van-radio-group v-model="form.filter_rule" direction="horizontal">
                <van-radio name="" shape="square">全部</van-radio>
                <van-radio v-for="r in ruleGroups" :key="r.id" :name="r.id" shape="square">{{ r.name }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="download_setting" label="下载设置">
            <template #input>
              <van-radio-group v-model="form.download_setting" direction="horizontal" @change="onDownloadSettingChange">
                <van-radio name="" shape="square">站点设置</van-radio>
                <van-radio v-for="d in downloadSettings" :key="d.id" :name="d.id" shape="square">{{ d.name }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="save_path" label="保存路径">
            <template #input>
              <van-radio-group v-model="form.save_path" direction="horizontal">
                <van-radio name="" shape="square">自动</van-radio>
                <van-radio v-for="p in savePaths" :key="p" :name="p" shape="square">{{ p }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>

          <div style="display:flex;gap:8px;margin-top:16px">
            <van-button round block @click="activeStep = 'basic'">上一步</van-button>
            <van-button round block type="primary" native-type="submit" :loading="submitting">
              {{ props.rssid ? '保存' : '添加' }}
            </van-button>
          </div>
        </van-form>
      </template>
    </div>
  </van-popup>
</template>
