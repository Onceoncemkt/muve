export function negocioAccessCode(negocioId: string) {
  const limpio = negocioId.replace(/-/g, '').toUpperCase()
  return `NEG-${limpio.slice(0, 6)}`
}
