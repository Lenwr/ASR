export const money = cents => new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'}).format(cents / 100)
export const dayKey = date => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
export const dateLabel = value => value?.toDate ? value.toDate().toLocaleString('fr-FR', {timeZone:'Europe/Paris',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'En cours…'
export function summarize(rows) {
  const services = new Map(), operators = new Map(), days = new Map()
  let total = 0, pending = 0, count = 0
  for (const row of rows) {
    const operator = operators.get(row.operatorId) || {id:row.operatorId,name:row.operatorName || row.operatorId,count:0,services:0,total:0,pending:0}
    operator.count++
    operator.services += row.services.length
    for (const service of row.services) {
      if (Number.isInteger(service.priceCents)) operator.total += service.priceCents
      else operator.pending++
    }
    operators.set(row.operatorId, operator)
    days.set(row.date, (days.get(row.date) || 0) + row.services.length)
    for (const service of row.services) {
      count++
      const item = services.get(service.id) || {id:service.id,name:service.name,kind:service.kind || row.kind,count:0,total:0,pending:0}
      item.count++
      if (Number.isInteger(service.priceCents)) { item.total += service.priceCents; total += service.priceCents }
      else { item.pending++; pending++ }
      services.set(service.id,item)
    }
  }
  return {vehicles:new Set(rows.filter(r=>r.vehicle).map(r=>r.vehicle)).size,count,total,pending,services:[...services.values()],operators:[...operators.values()].sort((a,b)=>b.count-a.count),days}
}
export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"','""') + '"'
}
export function exportCsv(rows) {
  const lines = [['Date','Véhicule','Secteur','Type','Opérateur','Emplacement','Prestation','Montant EUR']]
  for (const row of rows) for (const service of row.services) lines.push([row.date,row.vehicle,row.sector,(service.kind || row.kind) === 'daily'?'Forfait journalier':'Unitaire',row.operatorName,row.location,service.name,service.priceCents == null?'À tarifer':(service.priceCents/100).toFixed(2).replace('.',',')])
  return '\uFEFF' + lines.map(line=>line.map(csvCell).join(';')).join('\r\n')
}
