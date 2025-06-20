// Utility function to normalize Polish characters for search
export const normalizePolishText = (text: string): string => {
  const polishChars: { [key: string]: string } = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o', 'Ś': 's', 'Ź': 'z', 'Ż': 'z'
  };
  
  return text.toLowerCase().replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (match) => polishChars[match] || match);
};

// Create search keywords from text (splits by spaces and normalizes each word)
export const createSearchKeywords = (text: string): string[] => {
  return text
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => normalizePolishText(word.trim()));
};

// Create a comprehensive search text that includes all searchable fields
export const createSearchableText = (fields: string[]): string => {
  return fields
    .filter(field => field && field.trim().length > 0)
    .map(field => normalizePolishText(field.trim()))
    .join(' ');
}; 