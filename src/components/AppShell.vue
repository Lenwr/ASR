<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutDashboard, CarFront, Wrench, Users, SlidersHorizontal, LogOut, House, ArrowUpRight } from 'lucide-vue-next'
import Logo from './Logo.vue'
import { useAuthStore } from '../stores/auth'
import { roles } from '../lib/catalog'
const auth = useAuthStore(), router = useRouter()
const reporting = computed(()=>auth.profile?.role === 'admin')
const menuOrder = ref([])
const draggedMenu = ref('')
const menuItems = computed(() => [
  reporting.value && { id: 'dashboard', to: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard },
  reporting.value && { id: 'history', to: '/history', label: 'Historique véhicules', icon: CarFront },
  auth.profile?.role === 'admin' && { id: 'services', to: '/services', label: 'Prestations & tarifs', icon: SlidersHorizontal },
  auth.profile?.role === 'admin' && { id: 'users', to: '/users', label: 'Équipe & accès', icon: Users },
  { id: 'home', to: '/home', label: 'Mon espace', icon: House },
  auth.canAccess('parc') && { id: 'parc', to: '/parc', label: 'Parc', icon: CarFront },
  auth.canAccess('atelier') && { id: 'atelier', to: '/atelier', label: 'Atelier', icon: Wrench }
].filter(Boolean).sort((a,b) => (menuOrder.value.indexOf(a.id) < 0 ? 999 : menuOrder.value.indexOf(a.id)) - (menuOrder.value.indexOf(b.id) < 0 ? 999 : menuOrder.value.indexOf(b.id))))
onMounted(() => { try { menuOrder.value = JSON.parse(localStorage.getItem('asr.menuOrder') || '[]') } catch { menuOrder.value = [] } })
function dropMenu(target) {
  if (!draggedMenu.value || draggedMenu.value === target) return
  const ids = menuItems.value.map(item => item.id)
  const from = ids.indexOf(draggedMenu.value); const to = ids.indexOf(target)
  if (from < 0 || to < 0) return
  const [item] = ids.splice(from, 1); ids.splice(to, 0, item)
  menuOrder.value = ids; localStorage.setItem('asr.menuOrder', JSON.stringify(ids)); draggedMenu.value = ''
}
async function logout() { await auth.logout(); router.replace('/') }
</script>
<template>
  <div class="shell">
    <aside class="sidebar">
      <router-link to="/home" class="brand"><Logo/><span>OPÉRATIONS & PERFORMANCE</span></router-link>
      <div class="nav-label">ESPACE DE TRAVAIL</div>
      <nav aria-label="Navigation principale">
        <router-link v-for="item in menuItems" :key="item.id" :to="item.to" draggable="true" @dragstart="draggedMenu = item.id" @dragover.prevent @drop="dropMenu(item.id)"><component :is="item.icon" :size="19"/> {{ item.label }}</router-link>
      </nav>
      <div class="sidebar-note"><ArrowUpRight :size="20"/><strong>Chaque opération compte.</strong><p>Une activité tracée, une équipe connectée.</p></div>
      <div class="profile"><div class="avatar">{{ (auth.profile?.name || auth.profile?.email || 'AS').slice(0,2).toUpperCase() }}</div><div><strong>{{ auth.profile?.name || 'Mon compte' }}</strong><small>{{ roles[auth.profile?.role] }}</small></div><button class="icon-button" @click="logout" aria-label="Se déconnecter"><LogOut :size="18"/></button></div>
    </aside>
    <div class="workspace"><header class="topbar"><span>Automotive System Repair <span class="muted">/ Espace {{ reporting ? 'pilotage' : 'opérateur' }}</span></span><span class="today">{{ new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) }}</span></header><main class="content"><slot/></main><footer>ASR <span>Une vision claire de votre activité.</span></footer></div>
  </div>
</template>
