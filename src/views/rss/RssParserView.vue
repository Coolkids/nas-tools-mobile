<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog, showDialog } from 'vant'
import { getRssParserList, deleteRssParser, getRssParserDetail, updateRssParser, type RssParser, type RssParserPayload } from '@/api/rss'

const loading = ref(false)
const items = ref<RssParser[]>([])
const showForm = ref(false)
const editing = ref(false)
const form = ref<RssParserPayload>({ name: '', type: '', format: '', params: '' })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getRssParserList()
    if (res.code === 0) items.value = res.detail || []
    else showToast(res.msg || '加载失败')
  } catch { showToast('加载失败') } finally { loading.value = false }
}

function onAdd() {
  editing.value = false
  form.value = { name: '', type: '', format: '', params: '' }
  showForm.value = true
}

async function onEdit(id: string | number) {
  try {
    const res = await getRssParserDetail(id)
    if (res.code === 0) {
      const d = res.detail
      form.value = { id: d.id, name: d.name, type: d.type, format: d.format, params: d.params }
      editing.value = true
      showForm.value = true
    }
  } catch { showToast('加载失败') }
}

async function onDelete(id: string | number) {
  const ok = await showConfirmDialog({ title: '删除', message: '确认删除此解析器？' }).catch(() => false)
  if (!ok) return
  try { await deleteRssParser(id); showToast('删除成功'); load() }
  catch { showToast('删除失败') }
}

async function onSubmit() {
  if (!form.value.name) { showToast('请输入名称'); return }
  try {
    const res = await updateRssParser(form.value)
    if (res.code === 0) { showToast('保存成功'); showForm.value = false; load() }
    else showToast(res.msg || '保存失败')
  } catch { showToast('保存失败') }
}
</script>

<template>
  <div class="rss-parser page">
    <div style="padding:8px 12px">
      <van-button block type="primary" icon="plus" @click="onAdd">新增解析器</van-button>
    </div>

    <van-empty v-if="!loading && items.length === 0" description="暂无RSS解析器" />
    <div v-else class="list">
      <van-cell-group inset style="margin:12px">
        <van-cell
          v-for="item in items" :key="item.id"
          :title="item.name"
          :label="`${item.type} | ${item.format}`"
          is-link
          @click="onEdit(item.id)"
        >
          <template #right-icon>
            <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click.stop="onDelete(item.id)" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <van-popup v-model:show="showForm" position="bottom" round :style="{ height: '70%' }">
      <div style="padding:16px">
        <van-form @submit="onSubmit">
          <van-field v-model="form.name" label="名称" placeholder="解析器名称" :rules="[{ required: true, message: '请输入名称' }]" />
          <van-field v-model="form.type" label="类型" placeholder="解析器类型" />
          <van-field v-model="form.format" label="格式" placeholder="如 RSS/Atom" />
          <van-field v-model="form.params" label="参数" type="textarea" :rows="3" placeholder="解析参数" />
          <div style="margin-top:16px">
            <van-button block type="primary" native-type="submit">保存</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>
