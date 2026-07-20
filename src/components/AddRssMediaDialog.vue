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

const FORM_SEASONS = Array.from({ length: 50 }, (_, i) => ({ text: `第${i + 1}季`, value: `${i + 1}` }))
const showSeasonPicker = ref(false)
const seasonText = computed(() => {
  if (!form.season) return ''
  const found = FORM_SEASONS.find(s => s.value === form.season)
  return found ? found.text : ''
})
const RESTYPE_OPTIONS = ['BLURAY', 'REMUX', 'DOLBY', 'WEB', 'HDTV', 'UHD', 'HDR', '3D']
const PIX_OPTIONS = ['8k', '4k', '1080p', '720p']

const showRestypePicker = ref(false)
const showPixPicker = ref(false)
const showRulePicker = ref(false)
const showDownloadSettingPicker = ref(false)
const showSavePathPicker = ref(false)

const restypeColumns = [{ text: '全部', value: '' }, ...RESTYPE_OPTIONS.map(r => ({ text: r, value: r }))]
const pixColumns = [{ text: '全部', value: '' }, ...PIX_OPTIONS.map(p => ({ text: p, value: p }))]
const ruleColumns = computed(() => [{ text: '全部', value: '' }, ...ruleGroups.value.map(r => ({ text: r.name, value: r.id }))])
const downloadSettingColumns = computed(() => [{ text: '站点设置', value: '' }, ...downloadSettings.value.map(d => ({ text: d.name, value: d.id }))])
const savePathColumns = computed(() => [{ text: '自动', value: '' }, ...savePaths.value.map(p => ({ text: p, value: p }))])

const restypeText = computed(() => form.filter_restype || '全部')
const pixText = computed(() => form.filter_pix || '全部')
const ruleText = computed(() => {
  if (!form.filter_rule) return '全部'
  const found = ruleGroups.value.find(r => r.id === form.filter_rule)
  return found ? found.name : '全部'
})
const downloadSettingText = computed(() => {
  if (!form.download_setting) return '站点设置'
  const found = downloadSettings.value.find(d => d.id === form.download_setting)
  return found ? found.name : '站点设置'
})
const savePathText = computed(() => form.save_path || '自动')

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
  <van-popup v-model:show="visible" position="bottom"  :style="{ height: '85%' }" closeable>
    <div class="popup-header">{{ props.rssid ? '编辑订阅' : '新增订阅' }}</div>
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
          <van-field
            v-if="type === 'TV'"
            v-model="seasonText"
            is-link
            readonly
            name="season"
            label="季"
            placeholder="请选择季"
            :rules="[{ required: !form.fuzzy_match, message: '请选择季' }]"
            @click="showSeasonPicker = true"
          />
          <van-popup v-model:show="showSeasonPicker" position="bottom" >
            <van-picker
              :columns="FORM_SEASONS"
              @confirm="({ selectedOptions }: any) => { form.season = selectedOptions[0].value; showSeasonPicker = false }"
              @cancel="showSeasonPicker = false"
              style="height: 300px"
            />
          </van-popup>
          <van-field v-if="type === 'TV'" v-model="form.total_ep" label="总集数" placeholder="留空使用TMDB数据" />
          <van-field v-if="type === 'TV'" v-model="form.current_ep" label="开始集数" placeholder="开始订阅集数" />
          <van-field name="fuzzy_match" label="模糊匹配">
            <template #input><van-switch v-model="form.fuzzy_match" /></template>
          </van-field>
          <van-field name="over_edition" label="洗版">
            <template #input><van-switch v-model="form.over_edition" /></template>
          </van-field>
          <div style="margin-top: 16px">
            <van-button  block type="primary" native-type="submit">下一步</van-button>
          </div>
        </van-form>
      </template>

      <template v-else>
        <van-form @submit="submit()" style="margin-top: 12px">
          <van-field v-model="restypeText" is-link readonly name="filter_restype" label="质量" placeholder="请选择质量" @click="showRestypePicker = true" />
          <van-popup v-model:show="showRestypePicker" position="bottom" >
            <van-picker :columns="restypeColumns" @confirm="({ selectedOptions }: any) => { form.filter_restype = selectedOptions[0].value; showRestypePicker = false }" @cancel="showRestypePicker = false" style="height: 300px" />
          </van-popup>

          <van-field v-model="pixText" is-link readonly name="filter_pix" label="分辨率" placeholder="请选择分辨率" @click="showPixPicker = true" />
          <van-popup v-model:show="showPixPicker" position="bottom" >
            <van-picker :columns="pixColumns" @confirm="({ selectedOptions }: any) => { form.filter_pix = selectedOptions[0].value; showPixPicker = false }" @cancel="showPixPicker = false" style="height: 300px" />
          </van-popup>

          <van-field v-model="form.filter_team" label="制作组" placeholder="支持正则" />

          <van-field v-model="ruleText" is-link readonly name="filter_rule" label="过滤规则" placeholder="请选择过滤规则" @click="showRulePicker = true" />
          <van-popup v-model:show="showRulePicker" position="bottom" >
            <van-picker :columns="ruleColumns" @confirm="({ selectedOptions }: any) => { form.filter_rule = selectedOptions[0].value; showRulePicker = false }" @cancel="showRulePicker = false" style="height: 300px" />
          </van-popup>

          <van-field v-model="downloadSettingText" is-link readonly name="download_setting" label="下载设置" placeholder="请选择下载设置" @click="showDownloadSettingPicker = true" />
          <van-popup v-model:show="showDownloadSettingPicker" position="bottom" >
            <van-picker :columns="downloadSettingColumns" @confirm="({ selectedOptions }: any) => { form.download_setting = selectedOptions[0].value; showDownloadSettingPicker = false; onDownloadSettingChange(selectedOptions[0].value) }" @cancel="showDownloadSettingPicker = false" style="height: 300px" />
          </van-popup>

          <van-field v-model="savePathText" is-link readonly name="save_path" label="保存路径" placeholder="请选择保存路径" @click="showSavePathPicker = true" />
          <van-popup v-model:show="showSavePathPicker" position="bottom" >
            <van-picker :columns="savePathColumns" @confirm="({ selectedOptions }: any) => { form.save_path = selectedOptions[0].value; showSavePathPicker = false }" @cancel="showSavePathPicker = false" style="height: 300px" />
          </van-popup>

          <van-field name="rss_sites" label="RSS站点">
            <template #input>
              <van-checkbox-group v-model="rssSitesSelected" direction="horizontal" class="site-checkboxes">
                <van-checkbox v-for="s in rssSites" :key="s" :name="s" shape="square">{{ s }}</van-checkbox>
              </van-checkbox-group>
            </template>
          </van-field>
          <van-field name="search_sites" label="搜索站点">
            <template #input>
              <van-checkbox-group v-model="searchSitesSelected" direction="horizontal" class="site-checkboxes">
                <van-checkbox v-for="s in searchSites" :key="s" :name="s" shape="square">{{ s }}</van-checkbox>
              </van-checkbox-group>
            </template>
          </van-field>

          <div style="display:flex;gap:8px;margin-top:16px">
            <van-button  block @click="activeStep = 'basic'">上一步</van-button>
            <van-button  block type="primary" native-type="submit" :loading="submitting">
              {{ props.rssid ? '保存' : '添加' }}
            </van-button>
          </div>
        </van-form>
      </template>
    </div>
  </van-popup>
</template>

<style scoped>
.popup-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 44px;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  border-bottom: 1px solid var(--van-border-color, #ebedf0);
}
.site-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
}
</style>
