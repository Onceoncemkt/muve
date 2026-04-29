export function negocioAccessCode(nombreNegocio: string) {
  return nombreNegocio
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}
