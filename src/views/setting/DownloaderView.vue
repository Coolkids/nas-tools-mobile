<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { useModalStore } from '@/stores/modal'
import { testConnection } from '@/api/config'
import { getSystemConfig, setSystemConfig } from '@/api/config'

const { config, loading: cfgLoading, saving, load: loadCfg, save } = useConfigForm()
const modal = useModalStore()
const loading = ref(true)

const ptClient = ref('qbittorrent')
const activeTab = ref('qbittorrent')

const qbForm = reactive({ host: '', port: '8080', username: '', password: '', force_upload: false, auto_management: false })
const trForm = reactive({ host: '', port: '9091', username: '', password: '' })
const a115Form = reactive({ cookie: '' })
const aria2Form = reactive({ host: '', port: '6800', secret: '' })
const pikForm = reactive({ username: '', password: '', proxy: '' })

const speedForm = reactive({
  qb_upload: '', qb_download: '',
  tr_upload: '', tr_download: ''
})

onMounted(async () => {
  await loadCfg()
  if (config.value) {
    const c = config.value
    ptClient.value = String(c.pt?.pt_client || 'qbittorrent')
    activeTab.value = ptClient.value

    const qb = c.qbittorrent || {}
    qbForm.host = String(qb.qbhost || ''); qbForm.port = String(qb.qbport || '8080')
    qbForm.username = String(qb.qbusername || ''); qbForm.password = String(qb.qbpassword || '')
    qbForm.force_upload = !!qb.force_upload; qbForm.auto_management = !!qb.auto_management

    const tr = c.transmission || {}
    trForm.host = String(tr.trhost || ''); trForm.port = String(tr.trport || '9091')
    trForm.username = String(tr.trusername || ''); trForm.password = String(tr.trpassword || '')

    const a115 = c['client115'] || {}
    a115Form.cookie = String(a115.cookie || '')

    const aria2 = c.aria2 || {}
    aria2Form.host = String(aria2.host || ''); aria2Form.port = String(aria2.port || '6800')
    aria2Form.secret = String(aria2.secret || '')

    const pik = c.pikpak || {}
    pikForm.username = String(pik.username || ''); pikForm.password = String(pik.password || '')
    pikForm.proxy = String(pik.proxy || '')
  }
  await loadSpeedLimit()
  loading.value = false
})

async function loadSpeedLimit() {
  try {
    const res = await getSystemConfig('SpeedLimit')
    if (res.code === 0 && res.value) {
      const v = res.value as Record<string, string>
      speedForm.qb_upload = v.qb_upload ?? ''
      speedForm.qb_download = v.qb_download ?? ''
      speedForm.tr_upload = v.tr_upload ?? ''
      speedForm.tr_download = v.tr_download ?? ''
    }
  } catch { /* ignore */ }
}

async function onSelectClient(client: string) {
  ptClient.value = client
  activeTab.value = client
  await save({ 'pt.pt_client': client })
}

async function testClient(command: string) {
  modal.loading('测试中...')
  try {
    const res = await testConnection(command)
    if (res.code === 0) showToast('连接成功')
    else showToast(res.msg || '连接失败')
  } catch { showToast('连接失败') }
  finally { modal.close() }
}

async function onSaveQb() {
  await save({
    'pt.pt_client': 'qbittorrent',
    'qbittorrent.qbhost': qbForm.host, 'qbittorrent.qbport': qbForm.port,
    'qbittorrent.qbusername': qbForm.username, 'qbittorrent.qbpassword': qbForm.password,
    'qbittorrent.force_upload': qbForm.force_upload, 'qbittorrent.auto_management': qbForm.auto_management,
  })
}

async function onSaveTr() {
  await save({
    'pt.pt_client': 'transmission',
    'transmission.trhost': trForm.host, 'transmission.trport': trForm.port,
    'transmission.trusername': trForm.username, 'transmission.trpassword': trForm.password,
  })
}

async function onSave115() {
  await save({ 'pt.pt_client': '115', 'client115.cookie': a115Form.cookie })
}

async function onSaveAria2() {
  await save({
    'pt.pt_client': 'aria2',
    'aria2.host': aria2Form.host, 'aria2.port': aria2Form.port, 'aria2.secret': aria2Form.secret,
  })
}

async function onSavePik() {
  await save({
    'pt.pt_client': 'pikpak',
    'pikpak.username': pikForm.username, 'pikpak.password': pikForm.password, 'pikpak.proxy': pikForm.proxy,
  })
}

async function onSaveSpeed() {
  try {
    const res = await setSystemConfig('SpeedLimit', speedForm)
    if (res.code === 0) showToast('保存成功')
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}
</script>

<template>
  <div class="downloader page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-form v-else style="padding:12px">
      <van-cell-group inset>
        <van-cell title="下载器" />
        <van-radio-group v-model="ptClient" direction="horizontal" @change="onSelectClient">
          <van-radio name="qbittorrent" shape="square">Qb</van-radio>
          <van-radio name="transmission" shape="square">Tr</van-radio>
          <van-radio name="115" shape="square">115</van-radio>
          <van-radio name="aria2" shape="square">Aria2</van-radio>
          <van-radio name="pikpak" shape="square">PikPak</van-radio>
        </van-radio-group>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Qbittorrent 设置" />
        <van-field v-model="qbForm.host" label="地址" placeholder="http://192.168.1.x" />
        <van-field v-model="qbForm.port" label="端口" placeholder="8080" />
        <van-field v-model="qbForm.username" label="用户名" />
        <van-field v-model="qbForm.password" label="密码" type="password" />
        <van-field name="force_upload" label="强制做种">
          <template #input><van-switch v-model="qbForm.force_upload" /></template>
        </van-field>
        <van-field name="auto_management" label="自动管理">
          <template #input><van-switch v-model="qbForm.auto_management" /></template>
        </van-field>
        <van-button size="small" plain @click="testClient('qbittorrent')">测试连接</van-button>
        <van-button size="small" type="primary" style="margin-left:8px" @click="onSaveQb" :loading="saving">保存</van-button>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Transmission 设置" />
        <van-field v-model="trForm.host" label="地址" placeholder="http://192.168.1.x" />
        <van-field v-model="trForm.port" label="端口" placeholder="9091" />
        <van-field v-model="trForm.username" label="用户名" />
        <van-field v-model="trForm.password" label="密码" type="password" />
        <van-button size="small" plain @click="testClient('transmission')">测试连接</van-button>
        <van-button size="small" type="primary" style="margin-left:8px" @click="onSaveTr" :loading="saving">保存</van-button>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="115 设置" />
        <van-field v-model="a115Form.cookie" label="Cookie" type="textarea" :rows="2" placeholder="115登录Cookie" />
        <van-button size="small" type="primary" @click="onSave115" :loading="saving">保存</van-button>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Aria2 设置" />
        <van-field v-model="aria2Form.host" label="地址" placeholder="http://192.168.1.x" />
        <van-field v-model="aria2Form.port" label="端口" placeholder="6800" />
        <van-field v-model="aria2Form.secret" label="密钥" type="password" />
        <van-button size="small" type="primary" @click="onSaveAria2" :loading="saving">保存</van-button>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="PikPak 设置" />
        <van-field v-model="pikForm.username" label="用户名" />
        <van-field v-model="pikForm.password" label="密码" type="password" />
        <van-field v-model="pikForm.proxy" label="代理" placeholder="可选" />
        <van-button size="small" type="primary" @click="onSavePik" :loading="saving">保存</van-button>
      </van-cell-group>

      <van-cell-group inset style="margin-top:12px">
        <van-cell title="限速设置" />
        <van-field v-model="speedForm.qb_upload" label="Qb 上传限速(KB/s)" type="number" />
        <van-field v-model="speedForm.qb_download" label="Qb 下载限速(KB/s)" type="number" />
        <van-field v-model="speedForm.tr_upload" label="Tr 上传限速(KB/s)" type="number" />
        <van-field v-model="speedForm.tr_download" label="Tr 下载限速(KB/s)" type="number" />
        <van-button size="small" type="primary" @click="onSaveSpeed">保存限速</van-button>
      </van-cell-group>
    </van-form>
  </div>
</template>
