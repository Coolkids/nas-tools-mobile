<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { getMovieRssList, getTvRssList, getMovieCalendarData, getTvCalendarData } from '@/api/rss'

interface CalendarEvent {
  id: string | number
  title: string
  start: string
  poster?: string
  vote_average?: string | number
  year?: string
  type: string
  rssid?: string | number
}

const loading = ref(false)
const events = ref<CalendarEvent[]>([])
const viewMode = ref<'week' | 'month' | 'schedule'>('week')
const currentDate = ref(new Date())
const selectedDay = ref(new Date())

const dayNames = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isToday(d: Date) {
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isMovie(e: CalendarEvent) {
  return e.type === 'MOV' || e.type === '电影'
}

function eventsOf(date: Date) {
  const key = dateKey(date)
  return events.value.filter(e => (e.start || '').slice(0, 10) === key)
}

const weekStart = computed(() => {
  const d = new Date(currentDate.value)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
})

const weekDays = computed(() => {
  const start = weekStart.value
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
})

const weekLabel = computed(() => {
  const first = weekDays.value[0]
  const last = weekDays.value[6]
  return `${first.getMonth() + 1}/${first.getDate()} - ${last.getMonth() + 1}/${last.getDate()}`
})

const monthDays = computed(() => {
  const d = new Date(currentDate.value)
  d.setDate(1)
  const firstDay = d.getDay()
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

  const cells: { date: Date; type: 'prev' | 'current' | 'next' }[] = []

  for (let i = firstDay - 1; i >= 0; i--) {
    const prev = new Date(d)
    prev.setDate(-i)
    cells.push({ date: prev, type: 'prev' })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const day = new Date(d)
    day.setDate(i)
    cells.push({ date: day, type: 'current' })
  }
  const remainder = cells.length % 7
  if (remainder > 0) {
    for (let i = 1; i <= 7 - remainder; i++) {
      const next = new Date(d)
      next.setMonth(d.getMonth() + 1)
      next.setDate(i)
      cells.push({ date: next, type: 'next' })
    }
  }
  return cells
})

const monthLabel = computed(() => {
  return `${currentDate.value.getFullYear()}年${currentDate.value.getMonth() + 1}月`
})

const groupedSchedule = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events.value) {
    const key = (e.start || '').slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
})

const selectedDayEvents = computed(() => eventsOf(selectedDay.value))

function onPrev() {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'week') d.setDate(d.getDate() - 7)
  else if (viewMode.value === 'month') d.setMonth(d.getMonth() - 1)
  currentDate.value = d
  selectedDay.value = d
}

function onNext() {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'week') d.setDate(d.getDate() + 7)
  else if (viewMode.value === 'month') d.setMonth(d.getMonth() + 1)
  currentDate.value = d
  selectedDay.value = d
}

function onToday() {
  currentDate.value = new Date()
  selectedDay.value = new Date()
}

function selectDay(d: Date) {
  selectedDay.value = d
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
  <div class="rss-calendar">
    <van-sticky>
      <div class="calendar-header">
        <div class="header-top">
          <div class="mode-toggle">
            <button :class="{ active: viewMode === 'week' }" @click="viewMode = 'week'">周</button>
            <button :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">月</button>
            <button :class="{ active: viewMode === 'schedule' }" @click="viewMode = 'schedule'">日程</button>
          </div>
          <button class="refresh-btn" :disabled="loading" @click="load">
            <van-icon name="replay" />
          </button>
        </div>
        <div v-if="viewMode !== 'schedule'" class="header-nav">
          <van-icon name="arrow-left" @click="onPrev" />
          <span class="nav-label" @click="onToday">{{ viewMode === 'week' ? weekLabel : monthLabel }}</span>
          <van-icon name="arrow" @click="onNext" />
          <span class="today-btn" @click="onToday">今天</span>
        </div>
      </div>
    </van-sticky>

    <van-loading v-if="loading" size="20" class="loading-tip" />

    <template v-else>
      <div v-if="viewMode === 'week'" class="week-view">
        <div class="week-days">
          <div
            v-for="d in weekDays"
            :key="d.getTime()"
            class="week-day-item"
            :class="{ selected: isSameDay(d, selectedDay), today: isToday(d) && !isSameDay(d, selectedDay) }"
            @click="selectDay(d)"
          >
            <div class="week-day-name">{{ dayNames[d.getDay()] }}</div>
            <div class="week-day-num">{{ d.getDate() }}</div>
            <div v-if="eventsOf(d).length" class="week-day-bar" :class="eventsOf(d).some(e => isMovie(e)) ? 'movie' : 'tv'" />
          </div>
        </div>
        <div class="section-title" style="margin: 12px 12px 0">
          {{ selectedDay.getMonth() + 1 }}月{{ selectedDay.getDate() }}日
          <span class="section-day">{{ dayNames[selectedDay.getDay()] }}</span>
        </div>
        <div v-if="!selectedDayEvents.length" class="empty-tip">暂无日程</div>
        <div v-for="ev in selectedDayEvents" :key="`${ev.id}-${ev.start}`" class="event-card" :class="isMovie(ev) ? 'movie' : 'tv'">
          <img v-if="ev.poster" :src="ev.poster" class="event-poster" />
          <div v-else class="event-poster placeholder"><van-icon name="photo-o" /></div>
          <div class="event-body">
            <div class="event-title">{{ ev.title }}</div>
            <div class="event-meta">
              <van-tag size="small" :type="isMovie(ev) ? 'success' : 'primary'">{{ isMovie(ev) ? '电影' : '剧集' }}</van-tag>
              <span v-if="ev.vote_average" class="vote">★ {{ ev.vote_average }}</span>
              <span v-if="ev.year" class="event-year">{{ ev.year }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'month'" class="month-view">
        <div class="month-grid">
          <div v-for="n in dayNames" :key="n" class="grid-header">{{ n }}</div>
          <div
            v-for="cell in monthDays"
            :key="cell.date.getTime()"
            class="grid-cell"
            :class="{
              'prev-next': cell.type !== 'current',
              selected: cell.type === 'current' && isSameDay(cell.date, selectedDay),
              today: cell.type === 'current' && isToday(cell.date) && !isSameDay(cell.date, selectedDay),
              'has-event': eventsOf(cell.date).length > 0
            }"
            @click="cell.type === 'current' && selectDay(cell.date)"
          >
            <span class="cell-num">{{ cell.date.getDate() }}</span>
            <div v-if="eventsOf(cell.date).length > 0" class="cell-dots">
              <span v-if="eventsOf(cell.date).some(e => isMovie(e))" class="dot movie-dot" />
              <span v-if="eventsOf(cell.date).some(e => !isMovie(e))" class="dot tv-dot" />
            </div>
          </div>
        </div>
        <div class="month-events">
          <div class="section-title" style="margin: 12px 12px 0">
            {{ selectedDay.getMonth() + 1 }}月{{ selectedDay.getDate() }}日
            <span class="section-day">{{ dayNames[selectedDay.getDay()] }}</span>
          </div>
          <div v-if="!selectedDayEvents.length" class="empty-tip">暂无日程</div>
          <div v-for="ev in selectedDayEvents" :key="`${ev.id}-${ev.start}`" class="event-card" :class="isMovie(ev) ? 'movie' : 'tv'">
            <img v-if="ev.poster" :src="ev.poster" class="event-poster" />
            <div v-else class="event-poster placeholder"><van-icon name="photo-o" /></div>
            <div class="event-body">
              <div class="event-title">{{ ev.title }}</div>
              <div class="event-meta">
                <van-tag size="small" :type="isMovie(ev) ? 'success' : 'primary'">{{ isMovie(ev) ? '电影' : '剧集' }}</van-tag>
                <span v-if="ev.vote_average" class="vote">★ {{ ev.vote_average }}</span>
                <span v-if="ev.year" class="event-year">{{ ev.year }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'schedule'" class="schedule-view">
        <div v-if="!groupedSchedule.length" class="empty-tip" style="padding-top: 60px">暂无订阅日程</div>
        <template v-for="[date, list] in groupedSchedule" :key="date">
          <div class="schedule-date">
            <span class="schedule-date-text">{{ date }}</span>
            <span class="schedule-weekday">{{ dayNames[new Date(date).getDay()] }}</span>
          </div>
          <div v-for="ev in list" :key="`${ev.id}-${ev.start}`" class="event-card" :class="isMovie(ev) ? 'movie' : 'tv'">
            <img v-if="ev.poster" :src="ev.poster" class="event-poster" />
            <div v-else class="event-poster placeholder"><van-icon name="photo-o" /></div>
            <div class="event-body">
              <div class="event-title">{{ ev.title }}</div>
              <div class="event-meta">
                <van-tag size="small" :type="isMovie(ev) ? 'success' : 'primary'">{{ isMovie(ev) ? '电影' : '剧集' }}</van-tag>
                <span v-if="ev.vote_average" class="vote">★ {{ ev.vote_average }}</span>
                <span v-if="ev.year" class="event-year">{{ ev.year }}</span>
              </div>
            </div>
          </div>
        </template>
        <div class="schedule-summary">
          <van-tag type="success">电影</van-tag>
          <van-tag type="primary">剧集</van-tag>
          <span class="summary-count">共 {{ events.length }} 个订阅事件</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rss-calendar {
  min-height: 100vh;
  background: #f7f8fa;
}

/* header */
.calendar-header {
  background: #fff;
  padding: 10px 12px 8px;
  border-bottom: 1px solid #ebedf0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-toggle {
  display: flex;
  background: #f2f3f5;
  border-radius: 18px;
  padding: 2px;
}
.mode-toggle button {
  border: none;
  background: transparent;
  color: #646566;
  font-size: 13px;
  padding: 4px 16px;
  border-radius: 16px;
  transition: all 0.2s;
}
.mode-toggle button.active {
  background: #fff;
  color: #323233;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.refresh-btn {
  border: none;
  background: transparent;
  font-size: 18px;
  padding: 6px;
  color: #646566;
}

.header-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 14px;
  color: #323233;
}
.header-nav :deep(.van-icon) {
  font-size: 18px;
  padding: 4px 8px;
  color: #646566;
}
.nav-label {
  font-weight: 600;
  min-width: 150px;
  text-align: center;
}
.today-btn {
  font-size: 12px;
  color: #1989fa;
  padding: 2px 10px;
  border: 1px solid #1989fa;
  border-radius: 10px;
  margin-left: 4px;
}

/* week view */
.week-days {
  display: flex;
  background: #fff;
  padding: 12px 8px;
  border-bottom: 1px solid #ebedf0;
}
.week-day-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 0;
  border-radius: 8px;
  position: relative;
}
.week-day-item.selected {
  background: #1989fa;
}
.week-day-item.selected .week-day-name,
.week-day-item.selected .week-day-num {
  color: #fff;
}
.week-day-item.today .week-day-num {
  color: #1989fa;
  font-weight: 700;
}
.week-day-name {
  font-size: 11px;
  color: #969799;
}
.week-day-num {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}
.week-day-bar {
  width: 4px;
  height: 4px;
  border-radius: 2px;
  margin-top: 1px;
}
.week-day-bar.movie { background: #07c160; }
.week-day-bar.tv { background: #1989fa; }

/* event cards */
.event-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 12px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  border-left: 4px solid #1989fa;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.event-card.movie { border-left-color: #07c160; }
.event-card.tv { border-left-color: #1989fa; }

.event-poster {
  width: 42px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f2f3f5;
}
.event-poster.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8c9cc;
  font-size: 18px;
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

.vote {
  font-size: 11px;
  color: #ff976a;
}

.event-year {
  font-size: 11px;
  color: #969799;
}

/* month view */
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #fff;
  padding: 8px 4px 4px;
  border-bottom: 1px solid #ebedf0;
}

.grid-header {
  text-align: center;
  font-size: 12px;
  color: #969799;
  padding: 4px 0 8px;
}

.grid-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
  min-height: 44px;
  border-radius: 6px;
  position: relative;
}
.grid-cell.prev-next .cell-num {
  color: #c8c9cc;
}
.grid-cell.selected {
  background: #1989fa;
}
.grid-cell.selected .cell-num {
  color: #fff;
  font-weight: 600;
}
.grid-cell.selected .dot {
  background: #fff;
}
.grid-cell.today .cell-num {
  color: #1989fa;
  font-weight: 700;
}
.grid-cell.today.selected .cell-num {
  color: #fff;
}

.cell-num {
  font-size: 14px;
  color: #323233;
  line-height: 1.2;
}

.cell-dots {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.dot.movie-dot { background: #07c160; }
.dot.tv-dot { background: #1989fa; }

.month-events {
  margin-top: 4px;
  padding-bottom: 12px;
}

/* schedule view */
.schedule-date {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 4px;
}
.schedule-date-text {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.schedule-weekday {
  font-size: 12px;
  color: #969799;
}

.schedule-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #ebedf0;
  margin-top: 12px;
}

.summary-count {
  font-size: 12px;
  color: #969799;
  margin-left: auto;
}

/* common */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}
.section-day {
  font-size: 12px;
  font-weight: 400;
  color: #969799;
  margin-left: 6px;
}

.empty-tip {
  text-align: center;
  padding: 40px 0;
  color: #969799;
  font-size: 13px;
}

.loading-tip {
  padding: 60px 0;
  justify-content: center;
}
</style>
