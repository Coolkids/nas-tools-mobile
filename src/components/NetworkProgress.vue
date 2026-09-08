<script setup lang="ts">
import { requestProgressState } from '@/utils/requestProgress'
</script>

<template>
  <Transition name="network-progress">
    <div
      v-if="requestProgressState.visible"
      class="network-progress"
      :class="{
        'is-indeterminate': requestProgressState.indeterminate,
        'is-finishing': requestProgressState.finishing
      }"
      role="progressbar"
      aria-label="网络请求进度"
      :aria-valuenow="requestProgressState.indeterminate ? undefined : Math.round(requestProgressState.percent)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="network-progress__bar"
        :style="{ width: `${requestProgressState.percent}%` }"
      />
    </div>
  </Transition>
</template>

<style scoped>
.network-progress {
  position: fixed;
  z-index: 9999;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  overflow: hidden;
  pointer-events: none;
  background: transparent;
}

.network-progress__bar {
  height: 100%;
  min-width: 3px;
  background: var(--van-primary-color, #1989fa);
  box-shadow: 0 0 8px var(--van-primary-color, #1989fa);
  transition: width 160ms ease-out;
}

.is-indeterminate .network-progress__bar {
  width: 35% !important;
  animation: network-progress-slide 1.2s ease-in-out infinite;
}

.network-progress-enter-active,
.network-progress-leave-active {
  transition: opacity 160ms ease;
}

.network-progress-enter-from,
.network-progress-leave-to {
  opacity: 0;
}

@keyframes network-progress-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(285%); }
}
</style>
