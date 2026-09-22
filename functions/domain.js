export function validateOperation(data,catalog) {
  if (!data || !['parc','atelier'].includes(data.sector) || !['unit','daily'].includes(data.kind)) throw new Error('Secteur ou type invalide.')
  if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(data.requestId)) throw new Error('Identifiant de saisie invalide.')
  if (!Array.isArray(data.serviceIds) || data.serviceIds.length<1 || data.serviceIds.length>16 || new Set(data.serviceIds).size!==data.serviceIds.length) throw new Error('Sélection de prestations invalide.')
  const services=data.serviceIds.map(id=>catalog.find(s=>s.id===id && s.sector===data.sector && s.kind===data.kind))
  if(services.some(s=>!s)) throw new Error('Prestation incompatible avec le secteur ou le type de saisie.')
  const vehicle=typeof data.vehicle==='string'?data.vehicle.toUpperCase().replace(/[^A-Z0-9]/g,''):''
  const location=typeof data.location==='string'?data.location.trim().toUpperCase():''
  if (data.kind==='unit' && (vehicle.length<4 || vehicle.length>17)) throw new Error('Indiquez une plaque ou un VIN valide (4 à 17 caractères).')
  if(data.kind==='unit' && data.sector==='parc' && (!location || location.length>50)) throw new Error('L’emplacement Parc est obligatoire (50 caractères maximum).')
  return {sector:data.sector,kind:data.kind,vehicle:data.kind==='unit'?vehicle:'',location:data.kind==='unit'&&data.sector==='parc'?location:'',services}
}
export const canReport = profile => profile && profile.active !== false && ['admin','manager'].includes(profile.role)
export const canRecord = (profile,sector) => profile && profile.active !== false && (profile.role==='admin' || (profile.role==='operator' && profile[sector]===true))
export function validPrice(value) { return value===null || (Number.isSafeInteger(value) && value>=0 && value<=100000000) }
