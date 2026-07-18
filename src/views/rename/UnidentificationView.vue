<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { getUnknownList, delUnknownPath, renameUdf, type UnknownItem, type TransferMode, type ManualMediaType } from '@/api/rename'

const loading = ref(false)
const items = ref<UnknownItem[]>([])
const showForm = ref(false)
const formItem = ref<UnknownItem | null>(null)
const form = ref({ inpath: '', syncmod: 'copy' as TransferMode, type: 'movie' as ManualMediaType })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getUnknownList()
    if (res.code === 0) items.value = res.items || []
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function onRename(item: UnknownItem) {
  formItem.value = item
  form.value = { inpath: item.path, syncmod: 'copy', type: 'movie' }
  showForm.value = true
}

async function onSubmit() {
  try {
    const res = await renameUdf({ ...form.value })
    if (res.retcode === 0) { showToast('识别成功'); showForm.value = false; load() }
    else showToast(res.retmsg || '识别失败')
  } catch { showToast('识别失败') }
}

async function onDelete(id: number) {
  const ok = await showConfirmDialog({ title: '删除', message: '确认删除此路径？' }).catch(() => false)
  if (!ok) return
  try { await delUnknownPath(id); showToast('删除成功'); load() }
  catch { showToast('删除失败') }
}
</script>

<template>
  <div class="unid page">
    <van-empty v-if="!loading && items.length === 0" description="暂无未识别文件" />
    <div v-else class="list">
      <van-cell-group>
        <van-cell
          v-for="item in items" :key="item.id"
          :title="item.name"
          :label="item.path"
          is-link
          @click="onRename(item)"
        >
          <template #right-icon>
            <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click.stop="onDelete(item.id)" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <van-popup v-model:show="showForm" position="bottom" round :style="{ height: '60%' }">
      <div style="padding:16px">
        <van-form @submit="onSubmit">
          <van-field v-model="form.inpath" label="路径" readonly />
          <van-field name="syncmod" label="转移方式">
            <template #input>
              <van-radio-group v-model="form.syncmod" direction="horizontal">
                <van-radio name="copy" shape="square">复制</van-radio>
                <van-radio name="link" shape="square">硬链接</van-radio>
                <van-radio name="move" shape="square">移动</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field name="type" label="类型">
            <template #input>
              <van-radio-group v-model="form.type" direction="horizontal">
                <van-radio name="movie" shape="square">电影</van-radio>
                <van-radio name="tv" shape="square">电视剧</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <div style="margin-top:16px">
            <van-button round block type="primary" native-type="submit">手动识别</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>
