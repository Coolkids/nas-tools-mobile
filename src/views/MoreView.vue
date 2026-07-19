<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const sections = [
  {
    title: '下载管理',
    items: [
      { name: 'downloading', label: '正在下载', icon: 'down', color: '#1989fa' },
      { name: 'downloaded', label: '最近下载', icon: 'clock-o', color: '#07c160' },
      { name: 'torrent_remove', label: '自动删种', icon: 'delete-o', color: '#ee0a24' },
      { name: 'userdownloader', label: '自定义下载器', icon: 'add-o', color: '#ff976a' },
    ]
  },
  {
    title: '媒体整理',
    items: [
      { name: 'mediafile', label: '文件管理', icon: 'description-o', color: '#ee0a24' },
      { name: 'history', label: '转移历史', icon: 'clock-o', color: '#1989fa' },
      { name: 'unidentification', label: '手动识别', icon: 'search', color: '#07c160' },
      { name: 'tmdbcache', label: 'TMDB缓存', icon: 'fire-o', color: '#7232dd' },
    ]
  },
  {
    title: '服务与管理',
    items: [
      { name: 'service', label: '服务', icon: 'service-o', color: '#1989fa' },
      { name: 'rss_history', label: '订阅历史', icon: 'records-o', color: '#07c160' },
      { name: 'user_rss', label: '自定义订阅', icon: 'contact', color: '#7232dd' },
      { name: 'rss_parser', label: 'RSS解析器', icon: 'more-o', color: '#ee0a24' },
      { name: 'rss_calendar', label: '订阅日历', icon: 'calendar-o', color: '#ff976a' },
    ]
  },
  {
    title: '系统设置',
    items: [
      { name: 'basic', label: '基础设置', icon: 'setting-o', color: '#1989fa' },
      { name: 'customwords', label: '自定义识别词', icon: 'edit', color: '#ee0a24' },
      { name: 'downloader', label: '下载器', icon: 'setting-o', color: '#07c160' },
      { name: 'download_setting', label: '下载设置', icon: 'gem-o', color: '#7232dd' },
      { name: 'directorysync', label: '目录同步', icon: 'exchange', color: '#ff976a' },
      { name: 'indexer', label: '索引器', icon: 'search', color: '#ff976a' },
      { name: 'mediaserver', label: '媒体服务器', icon: 'video-o', color: '#ee0a24' },
      { name: 'library', label: '媒体库', icon: 'tv-o', color: '#7232dd' },
      { name: 'notification', label: '消息通知', icon: 'bell', color: '#07c160' },
      { name: 'filterrule', label: '过滤规则', icon: 'filter-o', color: '#ff976a' },
      { name: 'subtitle', label: '字幕', icon: 'label-o', color: '#07c160' },
      { name: 'douban', label: '豆瓣同步', icon: 'star-o', color: '#1989fa' },
      { name: 'users', label: '用户管理', icon: 'contact', color: '#7232dd' },

    ]
  }
]

function go(name: string) {
  router.push({ name })
}
</script>

<template>
  <div class="more page">
    <div v-for="section in sections" :key="section.title" class="section">
      <div class="section-title">{{ section.title }}</div>
      <div class="section-grid">
        <div v-for="item in section.items" :key="item.name" class="grid-card" @click="go(item.name)">
          <div class="grid-icon" :style="{ background: item.color + '18', color: item.color }">
            <van-icon :name="item.icon" size="22" />
          </div>
          <div class="grid-label">{{ item.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.more { padding: 12px; }
.section { margin-bottom: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #323233; padding: 8px 4px; }
.section-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.grid-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer; }
.grid-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.grid-label { font-size: 11px; color: #646566; text-align: center; word-break: keep-all; }
</style>
