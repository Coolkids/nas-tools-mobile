<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useModalStore } from '@/stores/modal'
import { getSystemConfig, setSystemConfig } from '@/api/config'

const modal = useModalStore()
const loading = ref(false)
const saving = ref(false)

const form = reactive({
  qb_upload: '', qb_download: '',
  tr_upload: '', tr_download: '',
  ipv4: '', ipv6: '', bandwidth: '',
  residual_ratio: '', allocation: ''
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getSystemConfig('SpeedLimit')
    if (res.code === 0 && res.value) {
      const v = res.value as Record<string, string>
      Object.assign(form, {
        qb_upload: v.qb_upload ?? '', qb_download: v.qb_download ?? '',
        tr_upload: v.tr_upload ?? '', tr_download: v.tr_download ?? '',
        ipv4: v.ipv4 ?? '', ipv6: v.ipv6 ?? '', bandwidth: v.bandwidth ?? '',
        residual_ratio: v.residual_ratio ?? '', allocation: v.allocation ?? ''
      })
    }
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

async function onSave() {
  saving.value = true
  try {
    const res = await setSystemConfig('SpeedLimit', form)
    if (res.code === 0) showToast('保存成功')
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <div class="torrent-remove page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-form v-else @submit="onSave" style="padding:12px">
      <van-cell-group inset>
        <van-cell title="Qbittorrent" />
        <van-field v-model="form.qb_upload" label="上传限速(KB/s)" placeholder="留空不限速" type="number" />
        <van-field v-model="form.qb_download" label="下载限速(KB/s)" placeholder="留空不限速" type="number" />
      </van-cell-group>
      <van-cell-group inset style="margin-top:12px">
        <van-cell title="Transmission" />
        <van-field v-model="form.tr_upload" label="上传限速(KB/s)" placeholder="留空不限速" type="number" />
        <van-field v-model="form.tr_download" label="下载限速(KB/s)" placeholder="留空不限速" type="number" />
      </van-cell-group>
      <van-cell-group inset style="margin-top:12px">
        <van-cell title="I/O" />
        <van-field v-model="form.ipv4" label="IPv4 地址" placeholder="127.0.0.1" />
        <van-field v-model="form.ipv6" label="IPv6 地址" placeholder="::1" />
        <van-field v-model="form.bandwidth" label="带宽(Mbps)" placeholder="限速占用带宽" type="number" />
      </van-cell-group>
      <van-cell-group inset style="margin-top:12px">
        <van-cell title="自动删种" />
        <van-field v-model="form.residual_ratio" label="剩余分享率" placeholder="低于此值不删除" type="number" />
        <van-field v-model="form.allocation" label="站点保种数" placeholder="至少保留种子数" type="number" />
      </van-cell-group>
      <div style="margin-top:16px">
        <van-button round block type="primary" native-type="submit" :loading="saving">保存设置</van-button>
      </div>
    </van-form>
  </div>
</template>
