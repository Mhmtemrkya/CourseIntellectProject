import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './button';

/**
 * Tarayıcının İngilizce "Choose File / no file selected" varsayılanı yerine
 * Türkçe, biçimli bir dosya seçme düğmesi. Gizli bir <input type="file"> tetikler;
 * onChange olayını (event) olduğu gibi iletir ki mevcut yükleme mantığı bozulmasın.
 *
 * label     — düğme metni (varsayılan "Belge Yükle")
 * accept    — kabul edilen dosya türleri
 * multiple  — çoklu seçim
 * disabled  — devre dışı
 * required  — form doğrulaması için (seçim yoksa submit engellenir)
 * onChange(event) — yerel input'un onChange'i
 */
export function FileButton({ label = 'Belge Yükle', accept, multiple = false, disabled = false, required = false, onChange, className = '' }) {
  const ref = useRef(null);
  const [selected, setSelected] = useState('');

  const handleChange = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) setSelected('');
    else if (files.length === 1) setSelected(files[0].name);
    else setSelected(`${files.length} dosya seçildi`);
    onChange?.(event);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        required={required}
        className="hidden"
        onChange={handleChange}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />{label}
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={selected}>
        {selected || 'Dosya seçilmedi'}
      </span>
    </div>
  );
}
