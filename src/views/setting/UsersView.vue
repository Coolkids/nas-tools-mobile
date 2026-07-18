<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { doAction } from '@/api/request'

interface User {
  id: number
  name: string
  pris: Record<string, boolean>
}

const perms = [
  { key: 'view_media_library', label: '我的媒体库' },
  { key: 'search_resource', label: '资源搜索' },
  { key: 'explore', label: '发现' },
  { key: 'site_management', label: '站点管理' },
  { key: 'subscription_management', label: '订阅管理' },
  { key: 'download_management', label: '下载管理' },
  { key: 'media_organization', label: '媒体整理' },
  { key: 'services', label: '服务' },
  { key: 'system_settings', label: '系统设置' },
]

const loading = ref(false)
const users = ref<User[]>([])
const showEdit = ref(false)
const editing = ref({ name: '', password: '', pris: {} as Record<string, boolean> })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await doAction<{ code: number; detail: User[] }>('get_users', {})
    if (res.code === 0) users.value = res.detail || []
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

function onAdd() {
  const pris: Record<string, boolean> = {}
  perms.forEach(p => { pris[p.key] = true })
  editing.value = { name: '', password: '', pris }
  showEdit.value = true
}

async function onSave() {
  if (!editing.value.name || !editing.value.password) { showToast('请填写完整'); return }
  try {
    const res = await doAction<{ code: number; msg?: string }>('user_manager', { oper: 'add', ...editing.value })
    if (res.code === 0) { showToast('添加成功'); showEdit.value = false; load() }
    else showToast(res.msg || '添加失败')
  } catch { showToast('添加失败') }
}

async function onDelete(user: User) {
  const ok = await showConfirmDialog({ title: '删除', message: `确认删除用户「${user.name}」？` }).catch(() => false)
  if (!ok) return
  try {
    const res = await doAction<{ code: number; msg?: string }>('user_manager', { oper: 'del', name: user.name })
    if (res.code === 0) { showToast('删除成功'); load() }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}
</script>

<template>
  <div class="users page">
    <div style="padding:8px 12px">
      <van-button round block type="primary" icon="plus" @click="onAdd">新增用户</van-button>
    </div>

    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-empty v-else-if="users.length === 0" description="暂无用户" />

    <van-cell-group v-else inset style="margin:12px">
      <van-cell v-for="user in users" :key="user.id" :title="user.name">
        <template #value>
          <van-icon name="delete" style="color:#ee0a24;font-size:16px" @click="onDelete(user)" />
        </template>
      </van-cell>
    </van-cell-group>

    <van-popup v-model:show="showEdit" position="bottom" round :style="{ height: '70%' }" closeable title="新增用户">
      <van-form @submit="onSave" style="padding:16px">
        <van-field v-model="editing.name" label="用户名" :rules="[{ required: true }]" />
        <van-field v-model="editing.password" label="密码" type="password" :rules="[{ required: true }]" />
        <van-cell title="权限" />
        <van-checkbox-group v-model="editing.pris" :model-value="Object.keys(editing.pris).filter(k => editing.pris[k])" @update:model-value="(vals: string[]) => { const p: Record<string, boolean> = {}; perms.forEach(pp => { p[pp.key] = vals.includes(pp.key) }); editing.pris = p }">
          <van-checkbox v-for="p in perms" :key="p.key" :name="p.key" shape="square" style="padding:10px 16px">{{ p.label }}</van-checkbox>
        </van-checkbox-group>
        <div style="margin-top:16px"><van-button round block type="primary" native-type="submit">添加</van-button></div>
      </van-form>
    </van-popup>
  </div>
</template>
