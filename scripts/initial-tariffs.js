import { catalog as source } from '../src/lib/catalog.js'
export const catalog = source.map(({initialPriceCents,...service}) => ({...service,priceCents:initialPriceCents}))
export const roles = { admin: 'Administrateur', superAdmin: 'Super administrateur' }
