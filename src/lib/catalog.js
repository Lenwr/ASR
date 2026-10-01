export const catalog = [
  ['jumelage','Jumelage','parc','unit',328], ['navette','Navette','parc','unit',436],
  ['chef-navette','Chef Navette','parc','daily',17780], ['inventaire','Inventaire','parc','daily',17780],
  ['controle','Contrôle','parc','daily',17780], ['esthetique','Esthétique complète','atelier','unit',1580],
  ['loueur','Loueur','atelier','unit',1035], ['vo','VO','atelier','unit',5000],
  ['entree','Entrée de chaîne','atelier','daily',null], ['sortie','Sortie de chaîne','atelier','daily',null],
  ['diagnostic','Diag','atelier','daily',null], ['pneumatiques','Pneumatiques','atelier','daily',null],
  ['batterie','Contrôle Batterie','atelier','daily',null], ['controle-esthetique','Contrôle esthétique','atelier','daily',null],
].map(([id,name,sector,kind,initialPriceCents]) => ({id,name,sector,kind,initialPriceCents}))

export const initialRates = Object.fromEntries(catalog.map(service => [service.id, service.initialPriceCents]))
export const roles = { admin: 'Administrateur', superAdmin: 'Super administrateur' }
