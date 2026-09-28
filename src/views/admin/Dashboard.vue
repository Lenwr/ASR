<script setup>import { ref, computed } from 'vue'
import { Download, ArrowUpRight, CarFront, Layers, Users, Wallet, Activity } from 'lucide-vue-next'

import { useOperations } from '../../lib/useOperations'
import { dayKey, summarize, money, dateLabel, exportCsv } from '../../lib/stats'
const period=ref('week'), sector=ref('all'), customStart=ref(dayKey(new Date())), customEnd=ref(dayKey(new Date()))
const filters=computed(()=> {
  const end=new Date(), start=new Date()
  if(period.value==='yesterday') {start.setDate(start.getDate()-1);end.setDate(end.getDate()-1)}
  if(period.value==='week') start.setDate(start.getDate()-6)
  if(period.value==='month') start.setDate(1)
  return period.value==='custom'?{start:customStart.value,end:customEnd.value}:{start:dayKey(start),end:dayKey(end)}
})
const {rows,loading,error}=useOperations(filters)
const selected=computed(()=>rows.value.filter(r=>sector.value==='all'||r.sector===sector.value))
const stats=computed(()=>summarize(selected.value))
const parc=computed(()=>selected.value.filter(r=>r.sector==='parc').reduce((n,r)=>n+r.services.length,0))
const share=computed(()=>stats.value.count?Math.round(parc.value/stats.value.count*100):0)
const points=computed(()=> {
  const entries=[...stats.value.days.entries()].sort(([a],[b])=>a.localeCompare(b))
  const max=Math.max(1,...entries.map(([,v])=>v))
  return entries.map(([date,value],i)=>({date,value,x:40+i*620/Math.max(1,entries.length-1),y:175-value/max*140}))
})
const line=computed(()=>points.value.map(p=>`${p.x},${p.y}`).join(' '))
function download() { const url=URL.createObjectURL(new Blob([exportCsv(selected.value)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`asr-${filters.value.start}-${filters.value.end}.csv`;a.click();URL.revokeObjectURL(url) }
</script>
<template>
  <div class="heading"><div><div class="eyebrow">PILOTAGE DE L’ACTIVITÉ</div><h1>Vue d'ensemble<span class="heading-dot">.</span></h1><p>Les bons indicateurs, pour avancer ensemble.</p></div><button class="secondary" @click="download" :disabled="loading || !!error || !selected.length"><Download :size="17"/> Exporter les données</button></div>
  <div class="toolbar"><div class="segmented"><button v-for="[key,label] in [['today',`Aujourd’hui`],['yesterday','Hier'],['week','7 jours'],['month','Ce mois'],['custom','Personnalisé']]" :key="key" :class="{selected:period===key}" @click="period=key">{{ label }}</button></div><select v-model="sector" aria-label="Secteur"><option value="all">Tous les secteurs</option><option value="parc">Parc automobile</option><option value="atelier">Atelier</option></select></div>
  <div v-if="period==='custom'" class="date-range"><label>Du <input type="date" v-model="customStart" :max="customEnd"/></label><label>Au <input type="date" v-model="customEnd" :min="customStart"/></label></div>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-else-if="loading" role="status" class="notice">Chargement de l’activité…</p>
  <template v-else-if="!error">
  <div class="kpis">
    <article v-for="item in [{label:'Véhicules distincts',value:stats.vehicles,icon:CarFront,note:'Identifiés sur la période',color:'blue'},{label:'Prestations réalisées',value:stats.count,icon:Layers,note:'Unitaires et forfaits',color:'purple'},{label:'Opérateurs actifs',value:stats.operators.length,icon:Users,note:'Au moins une saisie',color:'green'},{label:'Montant enregistré',value:money(stats.total),icon:Wallet,note:stats.pending?`${stats.pending} prestation(s) à tarifer`:'Tarifs historiques conservés',color:'orange'}]" :key="item.label"><div class="kpi-top"><span>{{ item.label }}</span><div class="icon-tile" :class="item.color"><component :is="item.icon" :size="20"/></div></div><strong>{{ item.value }}</strong><small>{{ item.note }}</small></article>
  </div>
  <div class="charts-grid"><section class="panel"><div class="panel-heading"><div><h2>Évolution de l’activité</h2><p>Nombre de prestations par jour actif</p></div><span class="badge"><span class="status-dot"/> Prestations</span></div>
    <div v-if="!stats.count" class="empty"><Activity :size="34"/><h3>Votre activité commence ici</h3><p>Les premières saisies alimenteront cette courbe.</p></div>
    <svg v-else class="line-chart" viewBox="0 0 700 220" role="img" aria-label="Nombre de prestations par jour actif"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#377df4" stop-opacity=".2"/><stop offset="100%" stop-color="#377df4" stop-opacity="0"/></linearGradient></defs><line v-for="y in [35,82,128,175]" :key="y" x1="30" x2="680" :y1="y" :y2="y" stroke="#e9eef5" stroke-dasharray="4 5"/><polygon :points="`40,175 ${line} ${points.at(-1).x},175`" fill="url(#area)"/><polyline :points="line" fill="none" stroke="#377df4" stroke-width="3" stroke-linejoin="round"/><g v-for="(p,i) in points" :key="p.date"><circle :cx="p.x" :cy="p.y" r="4" fill="#377df4"><title>{{ p.date }} : {{ p.value }} prestations</title></circle><text v-if="points.length<=8 || i%Math.ceil(points.length/7)===0" :x="p.x" y="207" text-anchor="middle" fill="#758298" font-size="11">{{ p.date.slice(8) }}/{{ p.date.slice(5,7) }}</text><text v-if="points.length<=8" :x="p.x" :y="p.y-12" text-anchor="middle" fill="#52617a" font-size="12">{{ p.value }}</text></g></svg>
  </section><section class="panel"><div class="panel-heading"><div><h2>Répartition par secteur</h2><p>Part des prestations réalisées</p></div></div><div class="donut" :style="{background: stats.count ? `conic-gradient(#377df4 0 ${share}%, #8b6ee8 ${share}% 100%)` : '#e9eef5'}" role="img" :aria-label="`Parc ${parc}, Atelier ${stats.count-parc}`"><div><strong>{{ stats.count }}</strong><small>prestations</small></div></div><div class="legend"><span><i class="blue-bg"/> Parc <b>{{ share }} %</b></span><span><i class="purple-bg"/> Atelier <b>{{ stats.count ? 100-share : 0 }} %</b></span></div></section></div>
  <div class="detail-grid"><section class="panel"><div class="panel-heading"><div><h2>Détail des prestations</h2><p>Volumes et montants sur la période</p></div><span class="badge">{{ stats.services.length }} activités</span></div><div class="table-scroll"><table><thead><tr><th>Prestation</th><th>Quantité</th><th>Montant</th></tr></thead><tbody><tr v-for="s in stats.services" :key="s.id"><td><strong>{{ s.name }}</strong><small>{{ s.kind==='daily'?'Forfait journalier':'À l’unité' }}</small></td><td>{{ s.count }}</td><td>{{ money(s.total) }}<small v-if="s.pending">{{ s.pending }} à tarifer</small></td></tr><tr v-if="!stats.services.length"><td colspan="3" class="empty-cell">Aucune prestation pour cette période.</td></tr></tbody></table></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Statistiques des utilisateurs</h2><p>Saisies, prestations et montants par opérateur</p></div><Users :size="20" class="muted"/></div><div v-for="(op,i) in stats.operators" :key="op.id" class="operator-row"><div class="avatar light">{{ op.name.slice(0,2).toUpperCase() }}</div><div><strong>{{ op.name }}</strong><small>{{ op.services }} prestation(s) · {{ money(op.total) }}{{ op.pending ? ` · ${op.pending} à tarifer` : '' }}</small><div class="mini-track"><div :style="{width:`${op.count/stats.operators[0].count*100}%`}"/></div></div><b>{{ op.count }} saisie(s)</b></div><p v-if="!stats.operators.length" class="empty-cell">Aucun opérateur actif sur la période.</p></section></div>
  <section class="panel"><div class="panel-heading"><div><h2>Dernières opérations</h2><p>La traçabilité, en temps réel</p></div><router-link class="text-link" to="/history">Tout consulter <ArrowUpRight :size="16"/></router-link></div><div class="table-scroll"><table><thead><tr><th>Véhicule / activité</th><th>Secteur</th><th>Opérateur</th><th>Emplacement</th><th>Date</th></tr></thead><tbody><tr v-for="r in selected.slice(0,5)" :key="r.id"><td><strong>{{ r.vehicle || 'Forfait journalier' }}</strong><small>{{ r.services.map(s=>s.name).join(', ') }}</small></td><td><span class="badge" :class="r.sector">{{ r.sector }}</span></td><td>{{ r.operatorName }}</td><td>{{ r.location || '—' }}</td><td>{{ dateLabel(r.createdAt) }}</td></tr><tr v-if="!selected.length"><td colspan="5" class="empty-cell">Les opérations validées apparaîtront ici.</td></tr></tbody></table></div></section>
  </template>
</template>
