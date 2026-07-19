<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { getMovieRssList, getTvRssList, getMovieCalendarData, getTvCalendarData, type MovieCalendarData, type TvCalendarEvent } from '@/api/rss'

interface CalendarEvent {
  id: string | number
  title: string
  start: string
  poster?: string
  vote_average?: string | number
  year?: string
  type?: string
  rssid?: string | number
}

const loading = ref(false)
const events = ref<CalendarEvent[]>([])
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const today = new Date()
const weekStart = new Date(today)
const day = today.getDay()
const diff = today.getDate() - day + (day === 0 ? -6 : 1)
weekStart.setDate(diff)
weekStart.setHours(0, 0, 0, 0)

const weekDates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + i)
  return d
})

const activeTab = ref(today.getDay())

function eventsOf(date: Date) {
  const key = dateKey(date)
  return events.value.filter(e => (e.start || '').slice(0, 10) === key)
}

function dateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [movieRes, tvRes] = await Promise.all([getMovieRssList(), getTvRssList()])
    const all: CalendarEvent[] = []

    const movieItems = movieRes.code === 0 ? Object.values(movieRes.result || {}) : []
    const tvItems = tvRes.code === 0 ? Object.values(tvRes.result || {}) : []

    await Promise.all([
      ...movieItems.map(async (m) => {
        try {
          const res = await getMovieCalendarData({ id: m.tmdbid, rssid: m.id })
          if (res.start) {
            all.push({
              id: res.id || m.id,
              title: res.title || m.name,
              start: res.start,
              poster: res.poster || m.image,
              vote_average: res.vote_average,
              year: res.year || m.year,
              type: 'MOV',
              rssid: res.rssid
            })
          }
        } catch { /* skip */ }
      }),
      ...tvItems.map(async (t) => {
        const season = t.season ? parseInt(t.season.replace('S', '')) : 1
        try {
          const res = await getTvCalendarData({ id: t.tmdbid, season, name: t.name, rssid: t.id })
          if (res.events) {
            for (const e of res.events) {
              all.push({
                id: e.id,
                title: e.title || t.name,
                start: e.start,
                poster: e.poster || t.image,
                vote_average: e.vote_average,
                year: e.year || t.year,
                type: 'TV',
                rssid: e.rssid
              })
            }
          }
        } catch { /* skip */ }
      })
    ])

    events.value = all
  } catch { showToast('加载日历失败') }
  finally { loading.value = false }
}
</script>

<template>
  <div class="rss-calendar page">
    <van-sticky>
      <van-tabs v-model:active="activeTab" swipeable>
        <van-tab v-for="(name, idx) in weekDays" :key="idx" :title="name" />
      </van-tabs>
    </van-sticky>
    <div style="padding: 12px">
      <van-loading v-if="loading" size="20" style="padding:40px;text-align:center" />
      <template v-else>
        <div class="date-header">{{ weekDates[activeTab].getMonth() + 1 }}月{{ weekDates[activeTab].getDate() }}日</div>
        <van-empty v-if="!eventsOf(weekDates[activeTab]).length" description="暂无更新" />
        <div v-else class="event-list">
          <div v-for="ev in eventsOf(weekDates[activeTab])" :key="ev.id" class="event-card">
            <img v-if="ev.poster" :src="ev.poster" class="event-poster" />
            <div class="event-body">
              <div class="event-title">{{ ev.title }}</div>
              <div class="event-meta">
                <van-tag v-if="ev.type === 'MOV'" size="small" type="primary">电影</van-tag>
                <van-tag v-else size="small" type="success">电视剧</van-tag>
                <span v-if="ev.vote_average" class="meta-vote">{{ ev.vote_average }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.date-header {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
}
.event-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.event-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.event-poster {
  width: 40px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f2f3f5;
}
.event-body {
  flex: 1;
  min-width: 0;
}
.event-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.meta-vote {
  font-size: 12px;
  color: #969799;
}
</style>
