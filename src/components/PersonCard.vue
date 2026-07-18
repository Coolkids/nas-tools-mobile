<script setup lang="ts">
defineProps<{
  personId?: string | number
  image?: string
  name?: string
  role?: string
}>()
</script>

<template>
  <div class="person-card">
    <div class="person-image-wrap">
      <img
        v-if="image"
        :src="image"
        :alt="name"
        class="person-image"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="person-placeholder">
        <van-icon name="contact" size="28" />
      </div>
    </div>
    <h3 class="person-name">{{ name }}</h3>
    <div class="person-role">{{ role }}</div>
  </div>
</template>

<style scoped>
.person-card {
  text-align: center;
  padding: 12px 8px;
  border-radius: 8px;
  background-color: #fff;
}
.person-image-wrap {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f2f3f5;
}
.person-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.person-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8c9cc;
}
.person-name {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.person-role {
  font-size: 11px;
  color: #969799;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
