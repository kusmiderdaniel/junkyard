// Custom currency formatter that always shows thousands separator for numbers >= 1000
export const formatCurrency = (amount: number): string => {
  // Force grouping for thousands by manually adding space separator
  if (amount >= 1000 && amount < 10000) {
    const parts = amount.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const thousands = integerPart.slice(0, -3);
    const hundreds = integerPart.slice(-3);
    return `${thousands} ${hundreds},${decimalPart} zł`;
  }

  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(amount);
};
