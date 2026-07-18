<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { useModalStore } from '@/stores/modal'
import { testConnection } from '@/api/config'

const modal = useModalStore()
const { config, loading: cfgLoading, saving, load: loadCfg, save } = useConfigForm()
const loading = ref(true)

const activeServer = ref('emby')
const embyForm = reactive({ host: '', api_key: '' })
const jellyfinForm = reactive({ host: '', api_key: '' })
const plexForm = reactive({ host: '', token: '', servername: '', username: '', password: '' })

onMounted(async () => {
  await loadCfg()
  if (config.value) {
    const c = config.value
    activeServer.value = String(c.media?.media_server || 'emby')

    const eb = c.emby || {}
    embyForm.host = String(eb.host || ''); embyForm.api_key = String(eb.api_key || '')

    const jf = c.jellyfin || {}
    jellyfinForm.host = String(jf.host || ''); jellyfinForm.api_key = String(jf.api_key || '')

    const px = c.plex || {}
    plexForm.host = String(px.host || ''); plexForm.token = String(px.token || '')
    plexForm.servername = String(px.servername || ''); plexForm.username = String(px.username || '')
    plexForm.password = String(px.password || '')
  }
  loading.value = false
})

async function onSaveEmby() {
  await save({
    'media.media_server': 'emby',
    'emby.host': embyForm.host, 'emby.api_key': embyForm.api_key,
  })
}

async function onSaveJellyfin() {
  await save({
    'media.media_server': 'jellyfin',
    'jellyfin.host': jellyfinForm.host, 'jellyfin.api_key': jellyfinForm.api_key,
  })
}

async function onSavePlex() {
  await save({
    'media.media_server': 'plex',
    'plex.host': plexForm.host, 'plex.token': plexForm.token,
    'plex.servername': plexForm.servername, 'plex.username': plexForm.username,
    'plex.password': plexForm.password,
  })
}

async function onTest(server: string) {
  modal.loading('测试中...')
  try {
    const res = await testConnection(server)
    if (res.code === 0) showToast('连接成功')
    else showToast(res.msg || '连接失败')
  } catch { showToast('连接失败') }
  finally { modal.close() }
}
</script>

<template>
  <div class="media-server page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-form v-else style="padding:12px">
      <van-cell-group inset>
        <van-cell title="媒体服务器" />
        <van-radio-group v-model="activeServer" direction="horizontal" @change="activeServer = $event">
          <van-radio name="emby" shape="square">Emby</van-radio>
          <van-radio name="jellyfin" shape="square">Jellyfin</van-radio>
          <van-radio name="plex" shape="square">Plex</van-radio>
        </van-radio-group>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Emby" />
        <van-field v-model="embyForm.host" label="地址" placeholder="http://192.168.1.x:8096" />
        <van-field v-model="embyForm.api_key" label="API Key" type="password" />
        <div style="padding:8px 16px;display:flex;gap:8px">
          <van-button size="small" plain @click="onTest('emby')">测试</van-button>
          <van-button size="small" type="primary" @click="onSaveEmby" :loading="saving">保存</van-button>
        </div>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Jellyfin" />
        <van-field v-model="jellyfinForm.host" label="地址" placeholder="http://192.168.1.x:8096" />
        <van-field v-model="jellyfinForm.api_key" label="API Key" type="password" />
        <div style="padding:8px 16px;display:flex;gap:8px">
          <van-button size="small" plain @click="onTest('jellyfin')">测试</van-button>
          <van-button size="small" type="primary" @click="onSaveJellyfin" :loading="saving">保存</van-button>
        </div>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Plex" />
        <van-field v-model="plexForm.host" label="地址" placeholder="http://192.168.1.x:32400" />
        <van-field v-model="plexForm.token" label="Token" />
        <van-field v-model="plexForm.servername" label="服务器名" />
        <van-field v-model="plexForm.username" label="用户名" />
        <van-field v-model="plexForm.password" label="密码" type="password" />
        <div style="padding:8px 16px;display:flex;gap:8px">
          <van-button size="small" plain @click="onTest('plex')">测试</van-button>
          <van-button size="small" type="primary" @click="onSavePlex" :loading="saving">保存</van-button>
        </div>
      </van-cell-group>
    </van-form>
  </div>
</template>
