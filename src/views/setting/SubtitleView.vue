<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'

const { config, loading: cfgLoading, saving, load: loadCfg, save } = useConfigForm()
const loading = ref(true)

const serverType = ref('opensubtitles')
const form = reactive({
  opensubtitles_enable: false,
  chinesesubfinder_host: '',
  chinesesubfinder_api_key: '',
  chinesesubfinder_local_path: '',
  chinesesubfinder_remote_path: '',
})

onMounted(async () => {
  await loadCfg()
  if (config.value) {
    const c = config.value
    serverType.value = String(c.subtitle?.server || 'opensubtitles')
    const os = c.subtitle?.opensubtitles || {}
    form.opensubtitles_enable = !!(os as Record<string, unknown>).enable
    const cs = c.subtitle?.chinesesubfinder || {}
    form.chinesesubfinder_host = String((cs as Record<string, unknown>).host || '')
    form.chinesesubfinder_api_key = String((cs as Record<string, unknown>).api_key || '')
    form.chinesesubfinder_local_path = String((cs as Record<string, unknown>).local_path || '')
    form.chinesesubfinder_remote_path = String((cs as Record<string, unknown>).remote_path || '')
  }
  loading.value = false
})

async function onSave() {
  await save({
    'subtitle.server': serverType.value,
    'subtitle.opensubtitles.enable': form.opensubtitles_enable,
    'subtitle.chinesesubfinder.host': form.chinesesubfinder_host,
    'subtitle.chinesesubfinder.api_key': form.chinesesubfinder_api_key,
    'subtitle.chinesesubfinder.local_path': form.chinesesubfinder_local_path,
    'subtitle.chinesesubfinder.remote_path': form.chinesesubfinder_remote_path,
  })
}
</script>

<template>
  <div class="subtitle page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-form v-else @submit="onSave" style="padding:12px">
      <van-cell-group inset>
        <van-cell title="字幕服务" />
        <van-radio-group v-model="serverType" direction="horizontal">
          <van-radio name="opensubtitles" shape="square">OpenSubtitles</van-radio>
          <van-radio name="chinesesubfinder" shape="square">ChineseSubFinder</van-radio>
        </van-radio-group>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="OpenSubtitles" />
        <van-field name="opensubtitles_enable" label="启用">
          <template #input><van-switch v-model="form.opensubtitles_enable" /></template>
        </van-field>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="ChineseSubFinder" />
        <van-field v-model="form.chinesesubfinder_host" label="地址" placeholder="http://127.0.0.1:19035" />
        <van-field v-model="form.chinesesubfinder_api_key" label="API Key" />
        <van-field v-model="form.chinesesubfinder_local_path" label="本地路径" placeholder="可选" />
        <van-field v-model="form.chinesesubfinder_remote_path" label="远程路径" placeholder="可选" />
      </van-cell-group>

      <div style="margin-top:16px">
        <van-button block type="primary" native-type="submit" :loading="saving">保存设置</van-button>
      </div>
    </van-form>
  </div>
</template>
