// Sunucuda üretilen belgeleri (base64) tarayıcıda indirtir.
// Sunucudan gelen PDF'i istemcide yeniden üretmeyiz: şablon tek yerde kalsın.
export function downloadBase64File(base64, fileName, mimeType = 'application/pdf') {
  if (!base64) return false;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'belge.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Sekme kapanmadan URL'i bırakmak sızıntı olur.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
