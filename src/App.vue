<script setup>
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
const route=useRoute()
</script>
<template>
  <AppShell v-if="route.meta.requiresAuth">
    <router-view v-slot="{ Component }">
      <Transition name="page">
        <component :is="Component" :key="route.path"/>
      </Transition>
    </router-view>
  </AppShell>
  <router-view v-else v-slot="{ Component }">
    <Transition name="page">
      <component :is="Component" :key="route.path"/>
    </Transition>
  </router-view>
</template>
