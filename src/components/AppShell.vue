<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutDashboard, CarFront, Wrench, Users, SlidersHorizontal, LogOut, House, ArrowUpRight } from 'lucide-vue-next'
import Logo from './Logo.vue'
import { useAuthStore } from '../stores/auth'
import { roles } from '../lib/catalog'
const auth = useAuthStore(), router = useRouter()
const reporting = computed(()=>auth.profile?.role === 'admin')
async function logout() { await auth.logout(); router.replace('/') }
</script>
<template>
  <div class="shell">
    <aside class="sidebar">
      <router-link to="/home" class="brand"><Logo/><span>OPÉRATIONS & PERFORMANCE</span></router-link>
      <div class="nav-label">ESPACE DE TRAVAIL</div>
      <nav aria-label="Navigation principale">
        <router-link v-if="reporting" to="/admin"><LayoutDashboard :size="19"/> Vue d'ensemble</router-link>
        <router-link v-if="reporting" to="/history"><CarFront :size="19"/> Historique véhicules</router-link>
        <router-link v-if="auth.profile?.role === 'admin'" to="/services"><SlidersHorizontal :size="19"/> Prestations & tarifs</router-link>
        <router-link v-if="auth.profile?.role === 'admin'" to="/users"><Users :size="19"/> Équipe & accès</router-link>
        <router-link to="/home"><House :size="19"/> Mon espace</router-link>
        <router-link v-if="auth.canAccess('parc')" to="/parc"><CarFront :size="19"/> Saisie Parc</router-link>
        <router-link v-if="auth.canAccess('atelier')" to="/atelier"><Wrench :size="19"/> Saisie Atelier</router-link>
      </nav>
      <div class="sidebar-note"><ArrowUpRight :size="20"/><strong>Chaque opération compte.</strong><p>Une activité tracée, une équipe connectée.</p></div>
      <div class="profile"><div class="avatar">{{ (auth.profile?.name || auth.profile?.email || 'AS').slice(0,2).toUpperCase() }}</div><div><strong>{{ auth.profile?.name || 'Mon compte' }}</strong><small>{{ roles[auth.profile?.role] }}</small></div><button class="icon-button" @click="logout" aria-label="Se déconnecter"><LogOut :size="18"/></button></div>
    </aside>
    <div class="workspace"><header class="topbar"><span>Automotive System Repair <span class="muted">/ Espace {{ reporting ? 'pilotage' : 'opérateur' }}</span></span><span class="today">{{ new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) }}</span></header><main class="content"><slot/></main><footer>ASR <span>Une vision claire de votre activité.</span></footer></div>
  </div>
</template>
