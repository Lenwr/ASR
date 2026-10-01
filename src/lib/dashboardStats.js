export function lawsonId(row) {
  const match = String(row.parcIdentifier || row.vehicle || '').trim().match(/^lawson\s*0*(\d+)$/i)
  return match ? `Lawson ${Number(match[1])}` : 'Non attribué'
}
export function cycleRange(month) {
  const [year, number] = month.split('-').map(Number)
  return {start:new Date(Date.UTC(year,number-2,26)).toISOString().slice(0,10),end:`${month}-25`}
}
const num = value => Math.max(0, Number(String(value ?? 0).replace(',', '.')) || 0)
export function dashboardStats(rows) {
  const details = rows.flatMap(row=>(row.services||[]).map(s=>{
    const movement=['jumelage','navette'].includes(s.id), daily=s.kind==='daily', prorata=daily&&row.prorata?.[s.id]===true
    return {key:`${row.id}-${s.id}`,lawson:lawsonId(row),date:row.date,activity:s.name,movement,daily,prorata,
      normal:daily?(prorata?num(row.hours?.[s.id]??7):7):num(row.hours?.[s.id]),
      known:daily||Object.hasOwn(row.hours||{},s.id),sup25:movement?num(row.hours25?.[s.id]):0,sup50:movement?num(row.hours50?.[s.id]):0,unit:movement?'mouv.':daily?'h':'unités'}
  }))
  const groups=new Map(), activities=new Map(), days=new Map()
  for(const row of rows){const id=lawsonId(row), g=groups.get(id)||{id,entries:0,hours:0,normal:0,sup25:0,sup50:0,prorata:0};g.entries++;groups.set(id,g);days.set(row.date,(days.get(row.date)||0)+1)}
  for(const d of details){const g=groups.get(d.lawson);g.hours+=d.daily?d.normal:0;g.normal+=d.movement?d.normal:0;g.sup25+=d.sup25;g.sup50+=d.sup50;g.prorata+=Number(d.prorata);activities.set(d.activity,(activities.get(d.activity)||0)+1)}
  let amount=0, missingAmounts=0
  for(const row of rows){const text=String(row.price??'').replace(/\s|€/g,'').replace(',','.');if(text&&Number.isFinite(Number(text)))amount+=Number(text);else missingAmounts++}
  return {details,groups:[...groups.values()].sort((a,b)=>a.id.localeCompare(b.id,'fr',{numeric:true})),activities:[...activities].map(([name,value])=>({name,value})),days:[...days].sort(([a],[b])=>a.localeCompare(b)),amount,missingAmounts,activeDays:days.size,entries:rows.length,
    hours:details.reduce((n,d)=>n+(d.daily?d.normal:0),0),normal:details.reduce((n,d)=>n+(d.movement?d.normal:0),0),sup25:details.reduce((n,d)=>n+d.sup25,0),sup50:details.reduce((n,d)=>n+d.sup50,0)}
}
