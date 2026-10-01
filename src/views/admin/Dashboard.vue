<script setup>
import { computed, ref } from 'vue'
import ActivityBreakdown from '../../components/ActivityBreakdown.vue'
import { useOperations } from '../../lib/useOperations'
import { useAuthStore } from '../../stores/auth'
import { dayKey, money } from '../../lib/stats'
import { cycleRange, dashboardStats, lawsonId } from '../../lib/dashboardStats'
const auth=useAuthStore(), today=dayKey(new Date()), initial=new Date(`${today}T12:00:00`)
if(initial.getDate()>25)initial.setMonth(initial.getMonth()+1,1)
const month=ref(dayKey(initial).slice(0,7)),lawson=ref('all'),sector=ref('all'),presentation=ref(false)
const filters=computed(()=>cycleRange(month.value||today.slice(0,7)))
const {rows,loading,error}=useOperations(filters)
const selected=computed(()=>rows.value.filter(r=>(sector.value==='all'||r.sector===sector.value)&&(lawson.value==='all'||lawsonId(r)===lawson.value)))
const stats=computed(()=>dashboardStats(selected.value))
const financial=computed(()=>auth.profile?.role==='superAdmin'&&!presentation.value)
const title=computed(()=>lawson.value==='all'?'Vue d’ensemble':`Bilan individuel · ${lawson.value}`)
const colors=['#377df4','#e85d75','#2fa37b','#e09b3d','#8b6ee8','#16a6a6','#d66b2f','#607dce','#b04c9b','#579b45','#d04f4f','#3e8bb5','#a98235','#7656a8','#3b9f85','#c45d91','#6e82a8','#a06d4f','#4c9c65','#c24e69']
const color=id=>colors[((Number(id.match(/\d+/)?.[0])||1)-1)%colors.length]
const format=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n)
const maxEntries=computed(()=>Math.max(1,...stats.value.groups.map(g=>g.entries)))
const points=computed(()=>{const max=Math.max(1,...stats.value.days.map(([,n])=>n));return stats.value.days.map(([date,value],i)=>({date,value,x:35+i*630/Math.max(1,stats.value.days.length-1),y:180-value/max*145}))})
const donut=computed(()=>{let sum=0;const total=stats.value.details.length;return total?`conic-gradient(${stats.value.activities.map((a,i)=>{const start=sum;sum+=a.value/total*100;return `${colors[i%colors.length]} ${start}% ${sum}%`}).join(',')})`:'#e9eef5'})
const quantities=computed(()=>[{name:'Mouvements normaux',value:stats.value.normal,color:'#377df4'},{name:'Mouvements majorés à 25 %',value:stats.value.sup25,color:'#e09b3d'},{name:'Mouvements majorés à 50 %',value:stats.value.sup50,color:'#e85d75'}])
const maxQuantity=computed(()=>Math.max(1,...quantities.value.map(q=>q.value)))
</script>
<template>
<div class="dashboard-audit">
  <div class="heading"><div><div class="eyebrow">ACTIVITÉ & PERFORMANCE</div><h1>{{title}}</h1><p>Les opérations sont attribuées au Lawson sélectionné lors de la saisie.</p></div></div>
  <div class="toolbar">
    <label>Cycle du 26 au 25 <input v-model="month" type="month" aria-label="Mois de fin du cycle"/></label>
    <label>Lawson <select v-model="lawson"><option value="all">Tous les Lawson</option><option v-for="n in 20" :key="n" :value="`Lawson ${n}`">Lawson {{n}}</option></select></label>
    <label>Secteur <select v-model="sector"><option value="all">Tous les secteurs</option><option value="parc">Parc</option><option value="atelier">Atelier</option></select></label>
    <label v-if="auth.profile?.role==='superAdmin'"><input v-model="presentation" type="checkbox"/> Masquer les montants</label>
  </div>
  <p class="scope">{{title}} · Du {{filters.start.split('-').reverse().join('/')}} au {{filters.end.split('-').reverse().join('/')}} · {{selected.length}} saisie(s)</p>
  <p v-if="loading" role="status">Chargement des statistiques…</p><p v-else-if="error" class="error" role="alert">{{error}}</p>
  <template v-else>
    <div v-if="!selected.length" class="panel">Aucune opération pour {{lawson==='all'?'ces filtres':lawson}} sur cette période.</div>
    <template v-else>
      <div class="kpis">
        <article><span>Saisies enregistrées</span><strong>{{stats.entries}}</strong></article>
        <article><span>{{lawson==='all'?'Lawson actifs':'Jours actifs'}}</span><strong>{{lawson==='all'?stats.groups.filter(g=>g.id!=='Non attribué').length:stats.activeDays}}</strong></article>
        <article><span>Heures des forfaits / prorata</span><strong>{{format(stats.hours)}} h</strong></article>
        <article><span>Mouvements normaux</span><strong>{{format(stats.normal)}}</strong></article>
        <article><span>Mouvements majorés · 25 % / 50 %</span><strong>{{format(stats.sup25)}} / {{format(stats.sup50)}}</strong></article>
        <article v-if="financial"><span>Montant enregistré</span><strong>{{money(stats.amount*100)}}</strong><small v-if="stats.missingAmounts">{{stats.missingAmounts}} saisie(s) sans montant exploitable</small></article>
      </div>
      <ActivityBreakdown :details="stats.details" :individual="lawson!=='all'"/>
      <div class="charts-grid">
        <section class="panel"><h2>Évolution des saisies</h2><p>Nombre d’opérations par jour actif</p>
          <svg class="line-chart" viewBox="0 0 700 225" role="img" :aria-label="`Évolution des saisies — ${title}`"><line x1="35" x2="665" y1="180" y2="180" stroke="#dce3ee"/><polyline :points="points.map(p=>`${p.x},${p.y}`).join(' ')" fill="none" stroke="#377df4" stroke-width="3"/><g v-for="(p,i) in points" :key="p.date"><circle :cx="p.x" :cy="p.y" r="5" fill="#377df4"><title>{{p.date}} : {{p.value}} saisie(s)</title></circle><text :x="p.x" :y="p.y-12" text-anchor="middle">{{p.value}}</text><text v-if="i%Math.ceil(points.length/7)===0" :x="p.x" y="210" text-anchor="middle">{{p.date.slice(8)}}/{{p.date.slice(5,7)}}</text></g></svg>
        </section>
        <section class="panel"><h2>Répartition des activités</h2><p>Nombre de prestations sélectionnées</p><div class="donut" :style="{background:donut}" role="img" aria-label="Répartition des prestations"><div><strong>{{stats.details.length}}</strong><small>prestations</small></div></div><div class="chart-legend"><span v-for="(a,i) in stats.activities" :key="a.name"><i :style="{background:colors[i%colors.length]}"/>{{a.name}} · {{a.value}} ({{format(a.value/stats.details.length*100)}} %)</span></div></section>
      </div>
      <div class="charts-grid">
        <section class="panel"><h2>{{lawson==='all'?'Activité par Lawson':'Normal et heures supplémentaires'}}</h2><p>{{lawson==='all'?'Cliquez sur un Lawson pour consulter son bilan.':'Quantités de mouvements, séparées selon leur majoration.'}}</p>
          <template v-if="lawson==='all'"><button v-for="g in stats.groups" :key="g.id" class="chart-row" :disabled="g.id==='Non attribué'" @click="lawson=g.id"><span>{{g.id}}</span><div class="track"><i :style="{width:`${g.entries/maxEntries*100}%`,background:color(g.id)}"/></div><b>{{g.entries}}</b></button></template>
          <template v-else><div v-for="q in quantities" :key="q.name" class="chart-row"><span>{{q.name}}</span><div class="track"><i :style="{width:`${q.value/maxQuantity*100}%`,background:q.color}"/></div><b>{{format(q.value)}}</b></div></template>
        </section>
        <section class="panel"><h2>Lecture des indicateurs</h2><p>Jumelage et Navette sont comptés en mouvements. Les heures des forfaits sont affichées séparément.</p><p>Un forfait complet représente 7 h. Lorsque le prorata est activé, la durée saisie est utilisée.</p><p>Les quantités anciennes non renseignées sont indiquées « — » dans le détail.</p><p v-if="lawson==='all'&&stats.groups.length===1">Un seul identifiant possède des saisies sur cette période : sa vue individuelle aura les mêmes totaux que la vue globale.</p></section>
      </div>
      <section class="panel"><h2>Tableau récapitulatif · {{lawson==='all'?'tous les Lawson':lawson}}</h2><div class="table-scroll"><table><thead><tr><th>Lawson</th><th>Saisies</th><th>Heures forfait / prorata</th><th>Mouv. normaux</th><th>Mouv. sup 25 %</th><th>Mouv. sup 50 %</th><th>Prorata appliqués</th></tr></thead><tbody><tr v-for="g in stats.groups" :key="g.id"><td>{{g.id}}</td><td>{{g.entries}}</td><td>{{format(g.hours)}} h</td><td>{{format(g.normal)}}</td><td>{{format(g.sup25)}}</td><td>{{format(g.sup50)}}</td><td>{{g.prorata}}</td></tr></tbody></table></div></section>
      <section v-if="lawson!=='all'" class="panel"><h2>Détail des prestations · {{lawson}}</h2><div class="table-scroll"><table><thead><tr><th>Date</th><th>Activité</th><th>Normal</th><th>Sup 25 %</th><th>Sup 50 %</th><th>Prorata</th></tr></thead><tbody><tr v-for="d in stats.details" :key="d.key"><td>{{d.date}}</td><td>{{d.activity}}</td><td>{{d.known?`${format(d.normal)} ${d.unit}`:'—'}}</td><td>{{d.movement?format(d.sup25):'—'}}</td><td>{{d.movement?format(d.sup50):'—'}}</td><td>{{d.prorata?`Oui · ${format(d.normal)} h / 7 h`:'Non'}}</td></tr></tbody></table></div></section>
    </template>
  </template>
</div>
</template>
<style scoped>
.dashboard-audit .toolbar{align-items:end;gap:20px}.toolbar label{display:flex;gap:8px;flex-direction:column}.scope{margin:24px 0;color:#52617a}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px;margin:24px 0}.kpis article{background:white;border:1px solid #e1e8f2;padding:24px;border-radius:18px;display:flex;flex-direction:column;gap:14px}.kpis strong{font-size:28px;color:#1d2b44}.kpis span,.panel p{color:#607089}.panel{margin-bottom:24px}.panel h2{margin-bottom:12px}.chart-legend{display:flex;flex-direction:column;gap:10px}.chart-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px}.chart-row{display:grid;grid-template-columns:minmax(130px,1fr) 2fr 45px;align-items:center;gap:16px;width:100%;padding:14px 0;border:0;background:transparent;text-align:left;color:#1d2b44}.track{height:12px;background:#edf1f7;border-radius:8px;overflow:hidden}.track i{display:block;height:100%;border-radius:8px}.line-chart text{fill:#52617a;font-size:12px}.table-scroll{margin-top:24px}td,th{white-space:nowrap}@media(max-width:700px){.charts-grid{display:block}.chart-row{grid-template-columns:1fr 1fr 35px}.kpis{grid-template-columns:1fr 1fr}.kpis article{padding:16px}}
</style>
