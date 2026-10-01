export function operationEdit(input, services) {
  const date = String(input.operationDate || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new Error('Date invalide.')
  const identifier = String(input.parcIdentifier || '').trim()
  if (input.sector === 'parc' && !/^Lawson (?:[1-9]|1[0-9]|20)$/.test(identifier)) throw new Error('Choisissez un Lawson.')
  const hours={}, hours25={}, hours50={}, prorata={}
  let total=0
  const quantity=(map,id,fallback=0)=>{
    const raw=map?.[id]
    const value=raw==null||raw===''?fallback:Number(raw)
    if (!Number.isFinite(value)||value<0||value>1000000) throw new Error('Les chiffres doivent être positifs et valides.')
    return value
  }
  for(const s of services){
    const movement=['jumelage','navette'].includes(s.id)
    const rate=s.id==='jumelage'?3.28:s.id==='navette'?4.36:177.8
    if(movement){hours[s.id]=quantity(input.hours,s.id);hours25[s.id]=quantity(input.hours25,s.id);hours50[s.id]=quantity(input.hours50,s.id);total+=rate*(hours[s.id]+hours25[s.id]*1.25+hours50[s.id]*1.5)}
    else {prorata[s.id]=input.prorata?.[s.id]===true;hours[s.id]=prorata[s.id]?quantity(input.hours,s.id,7):7;if(prorata[s.id]&&hours[s.id]===0)throw new Error('Le prorata doit être supérieur à zéro.');total+=rate*(prorata[s.id]?hours[s.id]/7:1)}
  }
  return {date,parcIdentifier:input.sector==='parc'?identifier:'',hours,hours25,hours50,prorata,price:`${total.toFixed(2)} €`,color:input.color||'',location:''}
}
