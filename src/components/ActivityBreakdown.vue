<script setup>
import { computed } from 'vue'
const props = defineProps({details:{type:Array,default:()=>[]},individual:Boolean})
const format = n => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n)
const series = [
  {key:'normal',label:'Normal',color:'#377df4'},
  {key:'sup25',label:'Heures sup 25 %',color:'#e09b3d'},
  {key:'sup50',label:'Heures sup 50 %',color:'#e85d75'},
]
const days = computed(()=>{
  const map = new Map()
  for(const d of props.details){
    const day=map.get(d.date)||{date:d.date,normal:0,sup25:0,sup50:0,hours:0,prorata:0}
    if(d.movement){day.normal+=d.normal;day.sup25+=d.sup25;day.sup50+=d.sup50}
    if(d.daily)day[d.prorata?'prorata':'hours']+=d.normal
    map.set(d.date,day)
  }
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date))
})
const totals = computed(()=>days.value.reduce((acc,d)=>{
  for(const key of ['normal','sup25','sup50','hours','prorata'])acc[key]+=d[key]
  return acc
},{normal:0,sup25:0,sup50:0,hours:0,prorata:0}))
const max = computed(()=>Math.max(1,...days.value.flatMap(d=>series.map(s=>d[s.key]))))
const hourMax = computed(()=>Math.max(1,totals.value.hours,totals.value.prorata))
const x = i => 45+i*600/Math.max(1,days.value.length-1)
const y = value => 170-value/max.value*135
const sum = computed(()=>totals.value.normal+totals.value.sup25+totals.value.sup50)
const gradient = computed(()=>{
  let end=0
  return sum.value?`conic-gradient(${series.map(s=>{const start=end;end+=totals.value[s.key]/sum.value*100;return `${s.color} ${start}% ${end}%`}).join(',')})`:'#e9eef5'
})
</script>
<template>
  <section class="panel breakdown">
    <h2>{{individual?'Bilan individuel':'Bilan général'}} · normal, heures sup et prorata</h2>
    <p>Jumelage / Navette : chiffres en mouvements. Forfaits et prorata : durée en heures.</p>
    <div class="breakdown-grid">
      <div>
        <h3>Évolution du normal et des majorations</h3>
        <div class="keys"><span v-for="s in series" :key="s.key"><i :style="{background:s.color}"/>{{s.label}}</span></div>
        <svg viewBox="0 0 690 215" role="img" aria-label="Évolution journalière des mouvements normaux et majorés à 25 et 50 pour cent">
          <g v-for="fraction in [0,.5,1]" :key="fraction"><line x1="45" x2="650" :y1="y(max*fraction)" :y2="y(max*fraction)" stroke="#e2e8f0" stroke-dasharray="4 4"/><text x="35" :y="y(max*fraction)+4" text-anchor="end">{{format(max*fraction)}}</text></g>
          <g v-for="s in series" :key="s.key"><polyline :points="days.map((d,i)=>`${x(i)},${y(d[s.key])}`).join(' ')" fill="none" :stroke="s.color" stroke-width="2.5"/><circle v-for="(d,i) in days" :key="d.date" :cx="x(i)" :cy="y(d[s.key])" :r="s.key==='normal'?5:s.key==='sup25'?4:3" :fill="s.color"><title>{{d.date}} · {{s.label}} : {{format(d[s.key])}} mouvements</title></circle></g>
          <text v-for="(d,i) in days.filter((_,i)=>i%Math.ceil(days.length/7)===0)" :key="d.date" :x="x(days.indexOf(d))" y="200" text-anchor="middle">{{d.date.slice(8)}}/{{d.date.slice(5,7)}}</text>
        </svg>
      </div>
      <div>
        <h3>Répartition des mouvements</h3>
        <div class="donut" :style="{background:gradient}" role="img" :aria-label="`${format(sum)} mouvements au total`"><div><strong>{{format(sum)}}</strong><small>mouvements</small></div></div>
        <div class="keys vertical"><span v-for="s in series" :key="s.key"><i :style="{background:s.color}"/>{{s.label}} : {{format(totals[s.key])}}</span></div>
        <p v-if="!sum">Aucun mouvement renseigné sur la période.</p>
      </div>
    </div>
    <h3>Heures des forfaits</h3>
    <div v-for="s in [{key:'hours',label:'Heures normales · forfait complet',color:'#2fa37b'},{key:'prorata',label:'Heures avec prorata',color:'#8b6ee8'}]" :key="s.key" class="duration-row"><span><i :style="{background:s.color}"/>{{s.label}}</span><div class="duration-track"><div :style="{width:`${totals[s.key]/hourMax*100}%`,background:s.color}"/></div><strong>{{format(totals[s.key])}} h</strong></div>
    <div v-if="individual" class="table-scroll">
      <table><caption>Récapitulatif journalier · mêmes couleurs que les graphiques</caption><thead><tr><th>Date</th><th v-for="s in series" :key="s.key"><i :style="{background:s.color}"/>{{s.label}} (mouv.)</th><th><i style="background:#2fa37b"/>Forfait complet (h)</th><th><i style="background:#8b6ee8"/>Prorata (h)</th></tr></thead><tbody><tr v-for="d in days" :key="d.date"><td>{{d.date.split('-').reverse().join('/')}}</td><td v-for="s in series" :key="s.key">{{format(d[s.key])}}</td><td>{{format(d.hours)}}</td><td>{{format(d.prorata)}}</td></tr></tbody><tfoot><tr><th>Total</th><th v-for="s in series" :key="s.key">{{format(totals[s.key])}}</th><th>{{format(totals.hours)}}</th><th>{{format(totals.prorata)}}</th></tr></tfoot></table>
    </div>
  </section>
</template>
<style scoped>
.breakdown{margin:24px 0}.breakdown-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:32px;margin:28px 0}.breakdown h3{margin:20px 0 16px}.breakdown p{color:#607089}.keys{display:flex;gap:16px;flex-wrap:wrap}.keys.vertical{flex-direction:column;gap:8px}.breakdown i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px}.breakdown svg{width:100%;margin-top:24px}.breakdown svg text{font-size:11px;fill:#52617a}.duration-row{display:grid;grid-template-columns:260px 1fr 90px;align-items:center;gap:20px;margin:20px 0}.duration-track{height:14px;background:#edf1f7;border-radius:10px;overflow:hidden}.duration-track>div{height:100%;border-radius:10px}.table-scroll{margin-top:32px}caption{text-align:left;padding:16px 0;font-weight:600}th,td{white-space:nowrap}tfoot{background:#f2f6fc}@media(max-width:800px){.breakdown-grid{grid-template-columns:1fr}.duration-row{grid-template-columns:1fr 80px}.duration-row>span{grid-column:1/-1}}
</style>
