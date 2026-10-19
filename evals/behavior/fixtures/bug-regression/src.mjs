export function applyDiscount(priceCents, percent) {
  return priceCents * (1 - percent / 100);
}
