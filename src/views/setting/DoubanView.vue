<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import { useConfigForm } from '@/composables/useConfigForm'
import { doAction } from '@/api/request'

const { config, loading: cfgLoading, saving, load: loadCfg, save } = useConfigForm()
const loading = ref(true)
const history = ref<Array<{ id: number; name: string; date: string; state: string }>>([])

const form = reactive({
  douban_users: '',
  douban_days: '7',
  douban_interval: '6',
  douban_types: 'do',
  douban_cookie: '',
  douban_auto_search: true,
  douban_auto_rss: true,
})

onMounted(async () => {
  await loadCfg()
  if (config.value) {
    const c = config.value
    form.douban_users = String(c.douban?.users ?? '')
    form.douban_days = String(c.douban?.days ?? '7')
    form.douban_interval = String(c.douban?.interval ?? '6')
    form.douban_types = String(c.douban?.types ?? 'do')
    form.douban_cookie = String(c.douban?.cookie ?? '')
    form.douban_auto_search = !!c.douban?.auto_search
    form.douban_auto_rss = !!c.douban?.auto_rss
  }
  await loadHistory()
  loading.value = false
})

async function loadHistory() {
  try {
    const res = await doAction<{ code: number; result?: Array<{ id: number; name: string; date: string; state: string }> }>('get_douban_history', {})
    if (res.code === 0) history.value = res.result || []
  } catch { /* ignore */ }
}

async function onSave() {
  await save({
    'douban.users': form.douban_users,
    'douban.days': form.douban_days,
    'douban.interval': form.douban_interval,
    'douban.types': form.douban_types,
    'douban.cookie': form.douban_cookie,
    'douban.auto_search': form.douban_auto_search,
    'douban.auto_rss': form.douban_auto_rss,
  })
}

async function onDeleteHistory(id: number) {
  try {
    const res = await doAction<{ code: number; msg?: string }>('delete_douban_history', { id })
    if (res.code === 0) { showToast('删除成功'); loadHistory() }
    else showToast(res.msg || '删除失败')
  } catch { showToast('删除失败') }
}
</script>

<template>
  <div class="douban page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <van-form v-else @submit="onSave" style="padding:12px">
      <van-cell-group inset>
        <van-cell title="豆瓣同步" />
        <van-field v-model="form.douban_users" label="用户ID" placeholder="逗号分隔多个用户ID" />
        <van-field v-model="form.douban_days" label="同步天数" placeholder="7" type="number" />
        <van-field v-model="form.douban_interval" label="同步间隔（小时）" placeholder="6" type="number" />
        <van-field v-model="form.douban_types" label="同步类型" placeholder="do/wish/collect" />
        <van-field v-model="form.douban_cookie" label="Cookie" placeholder="豆瓣登录Cookie" type="textarea" :rows="2" />
        <van-field name="auto_search" label="自动搜索">
          <template #input><van-switch v-model="form.douban_auto_search" /></template>
        </van-field>
        <van-field name="auto_rss" label="自动订阅">
          <template #input><van-switch v-model="form.douban_auto_rss" /></template>
        </van-field>
      </van-cell-group>
      <van-cell-group inset style="margin-top:12px">
        <van-cell title="同步历史" />
        <van-cell v-for="h in history" :key="h.id" :title="h.name" :label="h.date | h.state" is-link @click="onDeleteHistory(h.id)">
          <template #right-icon><van-icon name="delete" style="color:#ee0a24" /></template>
        </van-cell>
      </van-cell-group>
      <div style="margin-top:16px"><van-button block type="primary" native-type="submit" :loading="saving">保存设置</van-button></div>
    </van-form>
  </div>
</template>
