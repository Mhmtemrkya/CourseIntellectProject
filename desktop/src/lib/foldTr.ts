/** Türkçe harfleri katlar: "İSTANBUL" ile "istanbul", "Ğ" ile "g" eşleşir. */
export const foldTr = (text: string) =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/̇/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u');
