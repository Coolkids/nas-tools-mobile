<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { getRecommend, type RecommendItem } from '@/api/discovery'

const loading = ref(false)
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const today = new Date().getDay()
const currentWeek = ref(today)
const weekItems = ref<Record<number, RecommendItem[]>>({})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await getRecommend({ type: 'NEW_TV', page: 1 })
    if (res.code === 0) {
      const grouped: Record<number, RecommendItem[]> = {}
      for (const item of res.Items || []) {
        const d = item.date ? new Date(item.date).getDay() : new Date().getDay()
        if (!grouped[d]) grouped[d] = []
        grouped[d].push(item)
      }
      weekItems.value = grouped
    }
  } catch { showToast('加载日历失败') }
  finally { loading.value = false }
}
</script>

<template>
  <div class="rss-calendar page">
    <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
    <template v-else>
      <van-sticky>
        <van-tabs v-model:active="currentWeek" swipeable>
          <van-tab v-for="(_, idx) in weekDays" :key="idx" :title="weekDays[idx]">
            {{ '' }}
          </van-tab>
        </van-tabs>
      </van-sticky>
      <div style="padding: 12px">
        <van-empty v-if="!weekItems[currentWeek]?.length" description="暂无更新" />
        <van-cell
          v-for="item in weekItems[currentWeek] || []" :key="item.id"
          :title="item.title"
          :label="item.date"
        >
          <template #icon>
            <img :src="item.image" style="width:40px;height:56px;object-fit:cover;border-radius:4px;margin-right:8px" />
          </template>
          <template #value>
            <van-tag v-if="item.vote" size="small">{{ item.vote }}</van-tag>
          </template>
        </van-cell>
      </div>
    </template>
  </div>
</template>
