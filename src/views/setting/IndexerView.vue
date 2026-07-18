<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { useModalStore } from '@/stores/modal'
import { doAction } from '@/api/request'
import { testConnection } from '@/api/config'

const modal = useModalStore()
const { config, loading: cfgLoading, saving, load: loadCfg, save } = useConfigForm()
const loading = ref(true)

const activeTab = ref('builtin')
const searchIndexer = ref('builtin')

const sites = ref<Array<{ id: string; name: string }>>([])
const selectedSites = ref<string[]>([])

const jackettForm = reactive({ host: '', api_key: '', password: '' })
const prowlarrForm = reactive({ host: '', api_key: '' })

onMounted(async () => {
  await loadCfg()
  if (config.value) {
    const c = config.value
    searchIndexer.value = String(c.pt?.search_indexer || 'builtin')
    activeTab.value = searchIndexer.value

    const idx = c.indexer_sites
    if (idx && Array.isArray(idx)) selectedSites.value = idx as string[]

    const jk = c.jackett || {}
    jackettForm.host = String(jk.host || ''); jackettForm.api_key = String(jk.api_key || '')
    jackettForm.password = String(jk.password || '')

    const pr = c.prowlarr || {}
    prowlarrForm.host = String(pr.host || ''); prowlarrForm.api_key = String(pr.api_key || '')
  }
  await loadSites()
  loading.value = false
})

async function loadSites() {
  try {
    const res = await doAction<{ code: number; indexers: Array<{ id: string; name: string }> }>('get_indexers', {})
    if (res.code === 0) sites.value = res.indexers || []
  } catch { /* ignore */ }
}

async function onSaveBuiltin() {
  await save({
    'pt.search_indexer': 'builtin',
    'pt.indexer_sites': selectedSites.value,
  })
}

async function onSaveJackett() {
  await save({
    'pt.search_indexer': 'jackett',
    'jackett.host': jackettForm.host,
    'jackett.api_key': jackettForm.api_key,
    'jackett.password': jackettForm.password,
  })
}

async function onSaveProwlarr() {
  await save({
    'pt.search_indexer': 'prowlarr',
    'prowlarr.host': prowlarrForm.host,
    'prowlarr.api_key': prowlarrForm.api_key,
  })
}

async function onTestJackett() {
  modal.loading('测试中...')
  try {
    const res = await testConnection('jackett')
    if (res.code === 0) showToast('连接成功')
    else showToast(res.msg || '连接失败')
  } catch { showToast('连接失败') }
  finally { modal.close() }
}

async function onTestProwlarr() {
  modal.loading('测试中...')
  try {
    const res = await testConnection('prowlarr')
    if (res.code === 0) showToast('连接成功')
    else showToast(res.msg || '连接失败')
  } catch { showToast('连接失败') }
  finally { modal.close() }
}
</script>

<template>
  <div class="indexer page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-form v-else style="padding:12px">
      <van-cell-group inset>
        <van-cell title="索引器类型" />
        <van-radio-group v-model="searchIndexer" direction="horizontal" @change="activeTab = searchIndexer">
          <van-radio name="builtin" shape="square">内置</van-radio>
          <van-radio name="jackett" shape="square">Jackett</van-radio>
          <van-radio name="prowlarr" shape="square">Prowlarr</van-radio>
        </van-radio-group>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="内置索引器" />
        <van-checkbox-group v-model="selectedSites">
          <van-checkbox v-for="s in sites" :key="s.id" :name="s.id" shape="square" style="padding:10px 16px">{{ s.name }}</van-checkbox>
        </van-checkbox-group>
        <div style="padding:8px 16px"><van-button size="small" type="primary" @click="onSaveBuiltin" :loading="saving">保存</van-button></div>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Jackett" />
        <van-field v-model="jackettForm.host" label="地址" placeholder="http://127.0.0.1:9117" />
        <van-field v-model="jackettForm.api_key" label="API Key" />
        <van-field v-model="jackettForm.password" label="密码" type="password" />
        <div style="padding:8px 16px;display:flex;gap:8px">
          <van-button size="small" plain @click="onTestJackett">测试</van-button>
          <van-button size="small" type="primary" @click="onSaveJackett" :loading="saving">保存</van-button>
        </div>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Prowlarr" />
        <van-field v-model="prowlarrForm.host" label="地址" placeholder="http://127.0.0.1:9696" />
        <van-field v-model="prowlarrForm.api_key" label="API Key" />
        <div style="padding:8px 16px;display:flex;gap:8px">
          <van-button size="small" plain @click="onTestProwlarr">测试</van-button>
          <van-button size="small" type="primary" @click="onSaveProwlarr" :loading="saving">保存</van-button>
        </div>
      </van-cell-group>
    </van-form>
  </div>
</template>
