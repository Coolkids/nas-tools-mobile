<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { showToast } from 'vant'
import HelpTip from '@/components/HelpTip.vue'
import { addRssMedia, getRssSites, getIndexers, getRssDetail, type AddRssMediaParams } from '@/api/rss'
import { getDownloadDirs, getDownloadSettings, type DownloadSettingOption } from '@/api/download'
import { doAction } from '@/api/request'

const props = defineProps<{
  modelValue: boolean
  type?: 'MOV' | 'TV'
  rssid?: string | number
  initialName?: string
  initialYear?: string
  initialKeyword?: string
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
  type: '' as 'MOV' | 'TV' | '',
  name: '', year: '', keyword: '', season: '', fuzzy_match: false, over_edition: false,
  total_ep: '', current_ep: '', filter_restype: '', filter_pix: '', filter_team: '',
  filter_rule: '' as string | number, download_setting: '' as string | number, save_path: ''
})

const effectiveType = computed(() => form.type || props.type)

const rssSites = ref<string[]>([])
const searchSites = ref<string[]>([])
const rssSitesSelected = ref<string[]>([])
const searchSitesSelected = ref<string[]>([])
const downloadSettings = ref<DownloadSettingOption[]>([])
const savePaths = ref<string[]>([])
const ruleGroups = ref<Array<{ id: number | string; name: string }>>([])
const submitting = ref(false)
const activeStep = ref('basic')

const storageKey = computed(() => effectiveType.value === 'MOV' ? 'RssSettingMOV' : 'RssSettingTV')

watch(() => props.modelValue, async (open) => {
  if (!open) return
  resetForm()
  form.type = props.type || ''
  await loadOptions()
  if (props.rssid) await loadEditDetail()
  else {
    await loadSaved()
    if (props.initialName) form.name = props.initialName
    if (props.initialKeyword) form.keyword = props.initialKeyword
    if (props.initialYear) form.year = props.initialYear
  }
})

async function loadEditDetail() {
  if (!props.rssid) return
  try {
    const res = await getRssDetail(props.rssid, props.type)
    if (res.code !== 0 || !res.detail) return
    const d = res.detail
    Object.assign(form, {
      name: d.name || '', year: d.year || '', keyword: d.keyword || '',
      season: String(parseInt((d.season || '').replace(/^S/, ''), 10) || ''),
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
    type: '', name: '', year: '', keyword: '', season: '', fuzzy_match: false, over_edition: false,
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

function toggleItem(arr: string[], item: string) {
  const i = arr.indexOf(item)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(item)
}

async function submit(keepOpen = false) {
  if (!form.name) { showToast('请输入标题'); return }
  if (!effectiveType.value) { showToast('请选择类型'); return }
  if (form.year && isNaN(Number(form.year))) { showToast('年份需为数字'); return }
  if (!form.fuzzy_match && !form.season && effectiveType.value === 'TV') { showToast('请选择季'); return }
  if (form.total_ep && isNaN(Number(form.total_ep))) { showToast('总集数需为数字'); return }
  if (form.current_ep && isNaN(Number(form.current_ep))) { showToast('开始订阅集数需为数字'); return }

  const allRss = rssSitesSelected.value.length === rssSites.value.length || !rssSitesSelected.value.length
  const allSearch = searchSitesSelected.value.length === searchSites.value.length || !searchSitesSelected.value.length

  localStorage.setItem(storageKey.value, JSON.stringify({
    filter_restype: form.filter_restype, filter_pix: form.filter_pix, filter_team: form.filter_team,
    filter_rule: form.filter_rule, save_path: form.save_path, download_setting: form.download_setting,
    rss_sites: allRss ? [] : rssSitesSelected.value, search_sites: allSearch ? [] : searchSitesSelected.value
  }))

  const params: AddRssMediaParams = {
    type: effectiveType.value, name: form.name, year: form.year, keyword: form.keyword, season: form.season,
    fuzzy_match: form.fuzzy_match, over_edition: form.over_edition,
    rss_sites: allRss ? [] : rssSitesSelected.value, search_sites: form.fuzzy_match ? [] : allSearch ? [] : searchSitesSelected.value,
    filter_restype: form.filter_restype, filter_pix: form.filter_pix, filter_team: form.filter_team,
    filter_rule: form.filter_rule, save_path: form.save_path, download_setting: form.download_setting
  }
  if (props.rssid) params.rssid = props.rssid
  if (effectiveType.value === 'TV') { params.total_ep = form.total_ep; params.current_ep = form.current_ep }

  submitting.value = true
  try {
    const res = await addRssMedia(params)
    if (res.code === 0) { emit('success'); if (!keepOpen) visible.value = false; else resetForm() }
    else showToast(res.msg || '添加订阅失败')
  } catch (e) { showToast(e instanceof Error ? e.message : '添加订阅失败') }
  finally { submitting.value = false }
}
</script>

<template>
  <van-popup v-model:show="visible" position="bottom" round :style="{ height: '92%' }" closeable class="rss-dialog">
    <div class="dialog-container">
      <div class="dialog-header">{{ props.rssid ? '编辑订阅' : '新增订阅' }}</div>

      <van-steps class="dialog-steps" :active="activeStep === 'basic' ? 0 : 1">
        <van-step>基本信息</van-step>
        <van-step>订阅设置</van-step>
      </van-steps>

      <div class="dialog-main">
        <van-form v-if="activeStep === 'basic'" class="step-form" @submit="activeStep = 'setting'">
          <div class="form-body">
            <div class="group-title">订阅类型</div>
            <div class="segmented">
              <div class="segmented-item" :class="{ 'segmented-item--active': form.type === 'MOV' }" @click="form.type = 'MOV'">电影</div>
              <div class="segmented-item" :class="{ 'segmented-item--active': form.type === 'TV' }" @click="form.type = 'TV'">电视剧</div>
            </div>

            <div class="group-title">基本信息</div>
            <van-cell-group inset>
              <van-field v-model="form.name" label="标题" placeholder="请输入标题" :rules="[{ required: true, message: '请输入标题' }]" />
              <van-field v-model="form.year" label="年份" placeholder="年份" />
              <van-field v-model="form.keyword" label="搜索词" placeholder="留空使用TMDB数据" />
            </van-cell-group>

            <template v-if="effectiveType === 'TV'">
              <div class="group-title">剧集信息</div>
              <van-cell-group inset>
                <van-field
                  v-model="seasonText"
                  is-link
                  readonly
                  name="season"
                  label="季"
                  placeholder="请选择季"
                  :rules="[{ required: !form.fuzzy_match, message: '请选择季' }]"
                  @click="showSeasonPicker = true"
                />
                <van-field v-model="form.total_ep" label="总集数" placeholder="留空使用TMDB数据" />
                <van-field v-model="form.current_ep" label="开始集数" placeholder="开始订阅集数" />
              </van-cell-group>
            </template>

            <div class="group-title">匹配方式</div>
            <van-cell-group inset>
              <van-field name="fuzzy_match" label="模糊匹配">
                <template #input><van-switch v-model="form.fuzzy_match" /></template>
              </van-field>
              <van-field name="over_edition" label="洗版">
                <template #input><van-switch v-model="form.over_edition" /></template>
              </van-field>
            </van-cell-group>
          </div>

          <div class="form-footer">
            <van-button class="footer-btn" round type="primary" native-type="submit">下一步</van-button>
          </div>
        </van-form>

        <van-form v-else class="step-form" @submit="submit()">
          <div class="form-body">
            <div class="group-title">过滤条件</div>
            <van-cell-group inset>
              <van-field v-model="restypeText" is-link readonly name="filter_restype" label="质量" placeholder="请选择质量" @click="showRestypePicker = true" />
              <van-field v-model="pixText" is-link readonly name="filter_pix" label="分辨率" placeholder="请选择分辨率" @click="showPixPicker = true" />
              <van-field v-model="form.filter_team" label="制作组" placeholder="支持正则" />
              <van-field v-model="ruleText" is-link readonly name="filter_rule" label="过滤规则" placeholder="请选择过滤规则" @click="showRulePicker = true" />
            </van-cell-group>

            <div class="group-title">下载设置</div>
            <van-cell-group inset>
              <van-field v-model="downloadSettingText" is-link readonly name="download_setting" label="下载设置" placeholder="请选择下载设置" @click="showDownloadSettingPicker = true" />
              <van-field v-model="savePathText" is-link readonly name="save_path" label="保存路径" placeholder="请选择保存路径" @click="showSavePathPicker = true" />
            </van-cell-group>

            <div class="group-title">订阅站点</div>
            <van-cell-group inset>
              <div class="chip-field">
                <div class="chip-field__label">RSS站点</div>
                <div class="chips">
                  <span
                    v-for="s in rssSites"
                    :key="s"
                    class="chip"
                    :class="{ 'chip--active': rssSitesSelected.includes(s) }"
                    @click="toggleItem(rssSitesSelected, s)"
                  >{{ s }}</span>
                  <span v-if="!rssSites.length" class="chips-empty">暂无可用站点</span>
                </div>
              </div>
              <div class="chip-field">
                <div class="chip-field__label">搜索站点</div>
                <div class="chips">
                  <span
                    v-for="s in searchSites"
                    :key="s"
                    class="chip"
                    :class="{ 'chip--active': searchSitesSelected.includes(s) }"
                    @click="toggleItem(searchSitesSelected, s)"
                  >{{ s }}</span>
                  <span v-if="!searchSites.length" class="chips-empty">暂无可用站点</span>
                </div>
              </div>
            </van-cell-group>
          </div>

          <div class="form-footer">
            <van-button class="footer-btn" round @click="activeStep = 'basic'">上一步</van-button>
            <van-button class="footer-btn" round type="primary" native-type="submit" :loading="submitting">
              {{ props.rssid ? '保存' : '添加' }}
            </van-button>
          </div>
        </van-form>
      </div>
    </div>

    <van-popup v-model:show="showSeasonPicker" position="bottom" round>
      <van-picker
        :columns="FORM_SEASONS"
        @confirm="({ selectedOptions }: any) => { form.season = selectedOptions[0].value; showSeasonPicker = false }"
        @cancel="showSeasonPicker = false"
      />
    </van-popup>
    <van-popup v-model:show="showRestypePicker" position="bottom" round>
      <van-picker :columns="restypeColumns" @confirm="({ selectedOptions }: any) => { form.filter_restype = selectedOptions[0].value; showRestypePicker = false }" @cancel="showRestypePicker = false" />
    </van-popup>
    <van-popup v-model:show="showPixPicker" position="bottom" round>
      <van-picker :columns="pixColumns" @confirm="({ selectedOptions }: any) => { form.filter_pix = selectedOptions[0].value; showPixPicker = false }" @cancel="showPixPicker = false" />
    </van-popup>
    <van-popup v-model:show="showRulePicker" position="bottom" round>
      <van-picker :columns="ruleColumns" @confirm="({ selectedOptions }: any) => { form.filter_rule = selectedOptions[0].value; showRulePicker = false }" @cancel="showRulePicker = false" />
    </van-popup>
    <van-popup v-model:show="showDownloadSettingPicker" position="bottom" round>
      <van-picker :columns="downloadSettingColumns" @confirm="({ selectedOptions }: any) => { form.download_setting = selectedOptions[0].value; showDownloadSettingPicker = false; onDownloadSettingChange(selectedOptions[0].value) }" @cancel="showDownloadSettingPicker = false" />
    </van-popup>
    <van-popup v-model:show="showSavePathPicker" position="bottom" round>
      <van-picker :columns="savePathColumns" @confirm="({ selectedOptions }: any) => { form.save_path = selectedOptions[0].value; showSavePathPicker = false }" @cancel="showSavePathPicker = false" />
    </van-popup>
  </van-popup>
</template>

<style scoped>
.rss-dialog {
  --van-primary-color-light: #f0f5ff;
}

.dialog-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;
}

.dialog-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 44px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.dialog-steps {
  flex-shrink: 0;
  background: transparent;
  padding: 0 24px 10px;
}

.dialog-main {
  flex: 1;
  min-height: 0;
  display: flex;
}

.step-form {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.form-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 12px;
}

.group-title {
  margin: 14px 24px 8px;
  font-size: 13px;
  color: #969799;
}

.group-title:first-child {
  margin-top: 4px;
}

/* 类型分段选择器 */
.segmented {
  display: flex;
  margin: 0 16px;
  padding: 3px;
  background: #e8e9eb;
  border-radius: 10px;
}

.segmented-item {
  flex: 1;
  padding: 7px 0;
  text-align: center;
  font-size: 14px;
  color: #646566;
  border-radius: 8px;
  transition: all 0.2s;
}

.segmented-item--active {
  background: #fff;
  color: var(--van-primary-color, #1989fa);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

/* 站点标签选择 */
.chip-field {
  padding: 12px 16px;
}

.chip-field + .chip-field {
  border-top: 1px solid #f2f3f5;
}

.chip-field__label {
  margin-bottom: 10px;
  font-size: 14px;
  color: #646566;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 5px 12px;
  font-size: 13px;
  line-height: 1.4;
  color: #646566;
  background: #f2f3f5;
  border: 1px solid transparent;
  border-radius: 14px;
  transition: all 0.2s;
}

.chip--active {
  color: var(--van-primary-color, #1989fa);
  background: var(--van-primary-color-light, #f0f5ff);
  border-color: var(--van-primary-color, #1989fa);
}

.chips-empty {
  font-size: 13px;
  color: #969799;
}

/* 底部按钮 */
.form-footer {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f2f3f5;
}

.footer-btn {
  flex: 1;
}
</style>
