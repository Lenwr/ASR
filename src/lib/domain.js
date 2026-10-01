export function validateOperation(data, catalog) {
  if (
    !data ||
    !['parc', 'atelier'].includes(data.sector)
  ) {
    throw new Error('Secteur invalide.')
  }

  if (
    typeof data.requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(data.requestId)
  ) {
    throw new Error('Identifiant de saisie invalide.')
  }

  if (
    !Array.isArray(data.serviceIds) ||
    data.serviceIds.length < 1 ||
    data.serviceIds.length > 16 ||
    new Set(data.serviceIds).size !== data.serviceIds.length
  ) {
    throw new Error('Sélection de prestations invalide.')
  }

  const services = data.serviceIds.map(id =>
    catalog.find(
      service =>
        service.id === id &&
        service.sector === data.sector
    )
  )

  if (services.some(service => !service)) {
    throw new Error(
      'Une prestation sélectionnée est incompatible avec ce secteur.'
    )
  }

  const vehicle =
    typeof data.vehicle === 'string'
      ? data.vehicle
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
      : ''

  const location = ''
  const parcIdentifier = typeof data.parcIdentifier === 'string' ? data.parcIdentifier.trim() : ''
  const operationDate = typeof data.operationDate === 'string' ? data.operationDate : ''
  const color = typeof data.color === 'string' ? data.color.trim() : ''
  const revenue = typeof data.revenue === 'string' ? data.revenue.trim() : ''
  const price = typeof data.price === 'string' ? data.price.trim() : ''
  const overtime = typeof data.overtime === 'string' ? data.overtime.trim() : '0'
  const percent25 = data.percent25 === true
  const percent50 = data.percent50 === true
  const hours = data.hours && typeof data.hours === 'object' ? data.hours : {}
  const hours25 = data.hours25 && typeof data.hours25 === 'object' ? data.hours25 : {}
  const hours50 = data.hours50 && typeof data.hours50 === 'object' ? data.hours50 : {}
  const prorata = data.prorata && typeof data.prorata === 'object' ? data.prorata : {}

  if (vehicle.length > 40) throw new Error('L’identifiant ne peut pas dépasser 40 caractères.')
  if (data.sector === 'parc' && (!/^Lawson\s*(?:[1-9]|1[0-9]|20)$/i.test(parcIdentifier) || !/^\d{4}-\d{2}-\d{2}$/.test(operationDate))) throw new Error('Choisissez un identifiant Lawson de 1 à 20 et une date valide.')

  return {
    sector: data.sector,
    vehicle,
    location: '', parcIdentifier: data.sector === 'parc' ? parcIdentifier : '', operationDate, color, revenue, price, overtime, percent25, percent50, hours, hours25, hours50, prorata,
    services
  }
}
export const canReport = (profile) => profile && profile.active !== false && ['admin','superAdmin'].includes(profile.role);
export const canRecord = (profile, sector) =>
  profile &&
  profile.active !== false &&
  (['admin','superAdmin'].includes(profile.role) ||
    false);
export function validPrice(value) {
  return (
    value === null ||
    (Number.isSafeInteger(value) && value >= 0 && value <= 100000000)
  );
}
export const canManagePrices = profile => profile && profile.active !== false && profile.role === 'superAdmin'
