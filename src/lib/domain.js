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

  const location =
    typeof data.location === 'string'
      ? data.location.trim().toUpperCase()
      : ''

  if (vehicle.length > 17) {
    throw new Error('L’identifiant véhicule ne peut pas dépasser 17 caractères.')
  }

  if (
    data.sector === 'parc' &&
    (!location || location.length > 50)
  ) {
    throw new Error(
      'L’emplacement Parc est obligatoire (50 caractères maximum).'
    )
  }

  return {
    sector: data.sector,
    vehicle,
    location:
      data.sector === 'parc'
        ? location
        : '',
    services
  }
}
export const canReport = (profile) =>
  profile && profile.active !== false && profile.role === "admin";
export const canRecord = (profile, sector) =>
  profile &&
  profile.active !== false &&
  (profile.role === "admin" ||
    (profile.role === "operator" && profile[sector] === true));
export function validPrice(value) {
  return (
    value === null ||
    (Number.isSafeInteger(value) && value >= 0 && value <= 100000000)
  );
}
