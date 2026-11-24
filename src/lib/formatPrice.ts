export function formatLkrPrice(value: number): string {
  if (value >= 1000000) {
    const millions = value / 1000000;
    const formatted =
      millions % 1 === 0 ? millions.toString() : parseFloat(millions.toFixed(1)).toString();
    return `LKR ${formatted} M`;
  }

  return `LKR ${Math.round(value).toLocaleString("en-US")}`;
}
