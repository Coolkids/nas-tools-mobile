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

type ViewMode = 'week' | 'month' | 'schedule'

const loading = ref(false)
const events = ref<CalendarEvent[]>([])
const viewMode = ref<ViewMode>('week')
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

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events.value) {
    const key = (e.start || '').slice(0, 10)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
})

function eventsOf(date: Date) {
  return eventsByDate.value.get(dateKey(date)) || []
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

const groupedSchedule = computed(() =>
  Array.from(eventsByDate.value.entries()).sort(([a], [b]) => a.localeCompare(b))
)

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

function onCellClick(cell: { date: Date; type: 'prev' | 'current' | 'next' }) {
  if (cell.type !== 'current') currentDate.value = new Date(cell.date)
  selectedDay.value = new Date(cell.date)
}

function switchMode(m: ViewMode) {
  viewMode.value = m
  // 切换视图时，若选中日期不在当前范围内则跟随当前日期，避免界面状态不一致
  if (m === 'week' && !weekDays.value.some(d => isSameDay(d, selectedDay.value))) {
    selectedDay.value = new Date(currentDate.value)
  } else if (
    m === 'month' &&
    (selectedDay.value.getFullYear() !== currentDate.value.getFullYear() ||
      selectedDay.value.getMonth() !== currentDate.value.getMonth())
  ) {
    selectedDay.value = new Date(currentDate.value)
  }
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
        <div class="header-row">
          <div class="mode-toggle">
            <button :class="{ active: viewMode === 'week' }" @click="switchMode('week')">周</button>
            <button :class="{ active: viewMode === 'month' }" @click="switchMode('month')">月</button>
            <button :class="{ active: viewMode === 'schedule' }" @click="switchMode('schedule')">日程</button>
          </div>
          <div v-if="viewMode !== 'schedule'" class="header-nav">
            <button class="nav-arrow" aria-label="上一页" @click="onPrev">
              <van-icon name="arrow-left" />
            </button>
            <span class="nav-label" @click="onToday">{{ viewMode === 'week' ? weekLabel : monthLabel }}</span>
            <button class="nav-arrow" aria-label="下一页" @click="onNext">
              <van-icon name="arrow" />
            </button>
          </div>
          <div class="header-actions">
            <button v-if="viewMode !== 'schedule'" class="today-btn" @click="onToday">今天</button>
            <button class="refresh-btn" :disabled="loading" aria-label="刷新" @click="load">
              <van-icon name="replay" :class="{ 'is-spinning': loading }" />
            </button>
          </div>
        </div>
      </div>
    </van-sticky>

    <van-loading v-if="loading" size="22" class="loading-tip">加载中…</van-loading>

    <template v-else>
      <!-- 周视图 -->
      <div v-if="viewMode === 'week'" class="view-body week-view">
        <div class="week-strip">
          <div
            v-for="d in weekDays"
            :key="d.getTime()"
            class="week-day-item"
            :class="{ selected: isSameDay(d, selectedDay), today: isToday(d) }"
            @click="selectDay(d)"
          >
            <span class="week-day-name">{{ dayNames[d.getDay()] }}</span>
            <span class="week-day-num">{{ d.getDate() }}</span>
            <span class="week-dots">
              <i v-if="eventsOf(d).some(e => isMovie(e))" class="dot movie" />
              <i v-if="eventsOf(d).some(e => !isMovie(e))" class="dot tv" />
            </span>
          </div>
        </div>

        <div class="day-header">
          <span class="day-title">
            {{ selectedDay.getMonth() + 1 }}月{{ selectedDay.getDate() }}日
            <span class="day-week">周{{ dayNames[selectedDay.getDay()] }}</span>
          </span>
          <span v-if="selectedDayEvents.length" class="day-count">{{ selectedDayEvents.length }} 项</span>
        </div>

        <div v-if="!selectedDayEvents.length" class="empty-tip">
          <van-icon name="calendar-o" size="30" />
          <p>当日暂无更新</p>
        </div>
        <div v-else class="event-list">
          <div v-for="ev in selectedDayEvents" :key="`${ev.id}-${ev.start}`" class="event-card" :class="isMovie(ev) ? 'movie' : 'tv'">
            <img v-if="ev.poster" :src="ev.poster" class="event-poster" loading="lazy" :alt="ev.title" />
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

      <!-- 月视图 -->
      <div v-if="viewMode === 'month'" class="view-body month-view">
        <div class="month-panel">
          <div class="month-grid">
            <div v-for="n in dayNames" :key="n" class="grid-header">{{ n }}</div>
            <div
              v-for="cell in monthDays"
              :key="cell.date.getTime()"
              class="grid-cell"
              :class="{
                'prev-next': cell.type !== 'current',
                selected: cell.type === 'current' && isSameDay(cell.date, selectedDay),
                today: cell.type === 'current' && isToday(cell.date)
              }"
              @click="onCellClick(cell)"
            >
              <span class="cell-num">{{ cell.date.getDate() }}</span>
              <span class="cell-dots">
                <i v-if="eventsOf(cell.date).some(e => isMovie(e))" class="dot movie" />
                <i v-if="eventsOf(cell.date).some(e => !isMovie(e))" class="dot tv" />
              </span>
            </div>
          </div>
        </div>
        <div class="month-events">
          <div class="day-header">
            <span class="day-title">
              {{ selectedDay.getMonth() + 1 }}月{{ selectedDay.getDate() }}日
              <span class="day-week">周{{ dayNames[selectedDay.getDay()] }}</span>
            </span>
            <span v-if="selectedDayEvents.length" class="day-count">{{ selectedDayEvents.length }} 项</span>
          </div>
          <div v-if="!selectedDayEvents.length" class="empty-tip">
            <van-icon name="calendar-o" size="30" />
            <p>当日暂无更新</p>
          </div>
          <div v-else class="event-list">
            <div v-for="ev in selectedDayEvents" :key="`${ev.id}-${ev.start}`" class="event-card" :class="isMovie(ev) ? 'movie' : 'tv'">
              <img v-if="ev.poster" :src="ev.poster" class="event-poster" loading="lazy" :alt="ev.title" />
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
      </div>

      <!-- 日程视图 -->
      <div v-if="viewMode === 'schedule'" class="view-body schedule-view">
        <van-empty v-if="!groupedSchedule.length" description="暂无订阅日程" />
        <template v-for="[date, list] in groupedSchedule" :key="date">
          <div class="schedule-date">
            <span class="schedule-date-text">{{ date }}</span>
            <span class="schedule-weekday">周{{ dayNames[new Date(date).getDay()] }}</span>
            <span class="day-count">{{ list.length }} 项</span>
          </div>
          <div class="event-list">
            <div v-for="ev in list" :key="`${ev.id}-${ev.start}`" class="event-card" :class="isMovie(ev) ? 'movie' : 'tv'">
              <img v-if="ev.poster" :src="ev.poster" class="event-poster" loading="lazy" :alt="ev.title" />
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
        </template>
        <div v-if="groupedSchedule.length" class="schedule-summary">
          <span class="legend"><i class="dot movie" />电影</span>
          <span class="legend"><i class="dot tv" />剧集</span>
          <span class="summary-count">共 {{ events.length }} 个订阅事件</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rss-calendar {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--van-background, #f7f8fa);
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

/* ===== 头部 ===== */
.calendar-header {
  background: var(--van-background-2, #fff);
  padding: 10px 12px;
  border-bottom: 1px solid var(--van-border-color, #ebedf0);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  max-width: 960px;
  margin: 0 auto;
}

.mode-toggle {
  order: 1;
  display: flex;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 16px;
  padding: 3px;
}
.mode-toggle button {
  border: none;
  background: transparent;
  color: var(--van-text-color-2, #646566);
  font-size: 13px;
  padding: 4px 14px;
  min-width: 44px;
  border-radius: 13px;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.mode-toggle button.active {
  background: var(--van-background-2, #fff);
  color: var(--van-text-color, #323233);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.header-nav {
  order: 3;
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
}

.nav-arrow {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--van-text-color-2, #646566);
  font-size: 16px;
  -webkit-tap-highlight-color: transparent;
}
.nav-arrow:active {
  background: rgba(0, 0, 0, 0.05);
}

.nav-label {
  min-width: 132px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color, #323233);
  user-select: none;
}

.header-actions {
  order: 2;
  display: flex;
  align-items: center;
  gap: 6px;
}

.today-btn {
  border: 1px solid var(--van-primary-color, #1989fa);
  background: transparent;
  color: var(--van-primary-color, #1989fa);
  font-size: 12px;
  padding: 3px 12px;
  border-radius: 12px;
  -webkit-tap-highlight-color: transparent;
}
.today-btn:active {
  background: rgba(25, 137, 250, 0.08);
}

.refresh-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--van-text-color-2, #646566);
  font-size: 17px;
  -webkit-tap-highlight-color: transparent;
}
.refresh-btn:active {
  background: rgba(0, 0, 0, 0.05);
}
.refresh-btn:disabled {
  color: var(--van-text-color-3, #969799);
}
.refresh-btn .is-spinning {
  animation: cal-spin 0.9s linear infinite;
}
@keyframes cal-spin {
  to { transform: rotate(360deg); }
}

/* ===== 内容容器 ===== */
.view-body {
  max-width: 960px;
  margin: 0 auto;
}

/* ===== 周视图 ===== */
.week-strip {
  display: flex;
  margin: 12px 12px 0;
  padding: 10px 6px;
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.week-day-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0 6px;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.week-day-item:active {
  background: rgba(0, 0, 0, 0.04);
}

.week-day-name {
  font-size: 11px;
  color: var(--van-text-color-3, #969799);
}

.week-day-num {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color, #323233);
}

.week-day-item.today:not(.selected) .week-day-num {
  color: var(--van-primary-color, #1989fa);
  background: rgba(25, 137, 250, 0.1);
}
.week-day-item.selected .week-day-num {
  background: var(--van-primary-color, #1989fa);
  color: #fff;
  box-shadow: 0 2px 6px rgba(25, 137, 250, 0.35);
}
.week-day-item.selected .week-day-name {
  color: var(--van-primary-color, #1989fa);
  font-weight: 600;
}

.week-dots {
  display: flex;
  gap: 3px;
  height: 5px;
}

/* ===== 事件圆点 ===== */
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
}
.dot.movie { background: var(--van-success-color, #07c160); }
.dot.tv { background: var(--van-primary-color, #1989fa); }

/* ===== 日期分节标题 ===== */
.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 12px 8px;
}

.day-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color, #323233);
}
.day-title::before {
  content: '';
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--van-primary-color, #1989fa);
}

.day-week {
  font-size: 12px;
  font-weight: 400;
  color: var(--van-text-color-3, #969799);
}

.day-count {
  font-size: 11px;
  color: var(--van-primary-color, #1989fa);
  background: rgba(25, 137, 250, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
}

/* ===== 事件卡片 ===== */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px;
}

.event-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.12s ease;
}
.event-card:active {
  transform: scale(0.98);
}
.event-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--van-primary-color, #1989fa);
}
.event-card.movie::before {
  background: var(--van-success-color, #07c160);
}

.event-poster {
  width: 46px;
  height: 66px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: var(--van-background, #f2f3f5);
}
.event-poster.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--van-gray-5, #c8c9cc);
  font-size: 18px;
}

.event-body {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--van-text-color, #323233);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.vote {
  font-size: 11px;
  color: var(--van-orange, #ff976a);
}

.event-year {
  font-size: 11px;
  color: var(--van-text-color-3, #969799);
}

/* ===== 月视图 ===== */
.month-panel {
  margin: 12px 12px 0;
  padding: 8px 8px 10px;
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px 0;
}

.grid-header {
  text-align: center;
  font-size: 12px;
  color: var(--van-text-color-3, #969799);
  padding: 2px 0 8px;
}

.grid-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3px 0 5px;
  min-height: 48px;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.grid-cell:active {
  background: rgba(0, 0, 0, 0.04);
}
.grid-cell.prev-next {
  opacity: 0.35;
}

.cell-num {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  color: var(--van-text-color, #323233);
  line-height: 1;
}
.grid-cell.today:not(.selected) .cell-num {
  color: var(--van-primary-color, #1989fa);
  font-weight: 700;
  background: rgba(25, 137, 250, 0.1);
}
.grid-cell.selected .cell-num {
  background: var(--van-primary-color, #1989fa);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(25, 137, 250, 0.35);
}

.cell-dots {
  display: flex;
  gap: 3px;
  height: 5px;
  margin-top: 3px;
}

/* ===== 日程视图 ===== */
.schedule-date {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 12px 8px;
}
.schedule-date-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--van-text-color, #323233);
}
.schedule-weekday {
  font-size: 12px;
  color: var(--van-text-color-3, #969799);
}
.schedule-date .day-count {
  margin-left: auto;
}

.schedule-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 12px 0;
  padding: 10px 12px;
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  font-size: 12px;
  color: var(--van-text-color-2, #646566);
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.summary-count {
  margin-left: auto;
  color: var(--van-text-color-3, #969799);
}

/* ===== 空态 / 加载 ===== */
.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--van-text-color-3, #969799);
  font-size: 13px;
}
.empty-tip p {
  margin: 0;
}

.loading-tip {
  padding: 60px 0;
  justify-content: center;
}

/* ===== 小屏手机（<360px）===== */
@media (max-width: 359px) {
  .calendar-header { padding: 8px 10px; }
  .mode-toggle button { padding: 4px 11px; min-width: 40px; font-size: 12px; }
  .nav-label { min-width: 118px; font-size: 14px; }
  .week-strip { margin: 10px 10px 0; padding: 8px 4px; }
  .week-day-num { width: 26px; height: 26px; font-size: 14px; }
  .month-panel { margin: 10px 10px 0; padding: 6px 4px 8px; }
  .grid-cell { min-height: 44px; }
  .cell-num { width: 24px; height: 24px; font-size: 13px; }
  .day-header { margin: 12px 10px 6px; }
  .event-list { padding: 0 10px; }
  .event-card { padding: 8px 10px; gap: 10px; }
  .event-poster { width: 40px; height: 58px; }
}

/* ===== 较宽屏幕：头部合并为单行 ===== */
@media (min-width: 600px), (orientation: landscape) and (max-height: 540px) {
  .header-nav {
    order: 2;
    flex: 1 1 auto;
    margin-top: 0;
  }
  .header-actions {
    order: 3;
  }
}

/* ===== 平板 / 大屏 ===== */
@media (min-width: 768px) {
  .calendar-header { padding: 12px 16px; }
  .week-strip { padding: 12px 10px; }
  .week-day-num { width: 34px; height: 34px; font-size: 16px; }
  .week-day-name { font-size: 12px; }
  .grid-cell { min-height: 64px; }
  .cell-num { width: 30px; height: 30px; font-size: 15px; }
  .event-poster { width: 54px; height: 78px; }
  .event-title { font-size: 15px; }

  /* 事件卡片双列展示 */
  .week-view .event-list,
  .schedule-view .event-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ===== 月视图左右分栏（平板 & 手机横屏）===== */
@media (min-width: 768px), (orientation: landscape) and (max-height: 540px) {
  .month-view {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 4fr);
    column-gap: 12px;
    align-items: start;
    padding: 0 12px;
  }
  .month-view .month-panel { margin: 12px 0 0; }
  .month-view .month-events { margin-top: 12px; }
  .month-view .day-header { margin: 0 0 8px; }
  .month-view .event-list { padding: 0; }
}

@media (min-width: 1024px) {
  .week-view .event-list,
  .schedule-view .event-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ===== 手机横屏（低高度紧凑化，置于最后覆盖）===== */
@media (orientation: landscape) and (max-height: 540px) {
  .calendar-header { padding: 6px 12px; }
  .week-strip { margin-top: 8px; padding: 6px; }
  .week-day-item { padding: 2px 0 4px; gap: 2px; }
  .day-header { margin: 10px 12px 6px; }
  .grid-cell { min-height: 40px; }
  .empty-tip { padding: 24px 0; }
  .month-view .month-panel { margin-top: 8px; }
  .month-view .month-events { margin-top: 8px; }
  .month-view .day-header { margin: 0 0 6px; }
}
</style>
