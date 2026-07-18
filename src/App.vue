<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { onMounted } from 'vue'
import { NavBar, Tabbar, TabbarItem, Icon } from 'vant'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

onMounted(() => {
  appStore.init()
})

const isPublic = computed(() => route.meta?.public)
const showTabBar = computed(() => route.meta?.showTabBar)

const tabs = [
  { name: 'home', label: '首页', icon: 'home-o' },
  { name: 'recommend', label: '发现', icon: 'fire-o' },
  { name: 'search', label: '搜索', icon: 'search' },
  { name: 'movie_rss', label: '订阅', icon: 'tv-o' },
  { name: 'more', label: '更多', icon: 'more-o' },
]

const activeTab = computed(() => tabs.find(t => route.name === t.name)?.name || '')

function onTabChange(name: string) {
  router.push({ name })
}

function onBack() {
  router.back()
}

const showBack = computed(() => !showTabBar.value && route.path !== '/index' && !isPublic.value)
</script>

<template>
  <div class="app-shell">
    <NavBar
      v-if="!isPublic"
      :title="(route.meta?.title as string) || 'NAStool'"
      :left-arrow="showBack"
      @click-left="onBack"
      fixed
      placeholder
      safe-area-inset-top
    />

    <main class="app-main">
      <RouterView />
    </main>

    <Tabbar
      v-if="showTabBar"
      :model-value="activeTab"
      @change="onTabChange"
      fixed
      placeholder
      safe-area-inset-bottom
      route
    >
      <TabbarItem
        v-for="tab in tabs"
        :key="tab.name"
        :name="tab.name"
        :icon="tab.icon"
        :to="{ name: tab.name }"
      >
        {{ tab.label }}
      </TabbarItem>
    </Tabbar>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
