import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function BranchSelectWithCreate({ value, onValueChange, options, onCreate, label = 'Branş *', allowCreate = true }) {
  const [newBranch, setNewBranch] = useState('');
  const save = async () => {
    const clean = newBranch.trim();
    if (!clean || !onCreate) return;
    const created = await onCreate(clean);
    if (created !== false) {
      onValueChange(clean);
      setNewBranch('');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder="Branş seçin" /></SelectTrigger>
        <SelectContent>
          {options.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
        </SelectContent>
      </Select>
      {allowCreate && onCreate ? (
        <div className="flex gap-2">
          <Input
            value={newBranch}
            onChange={(event) => setNewBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            maxLength={80}
            placeholder="Yeni branş adı"
            aria-label="Yeni branş adı"
          />
          <Button type="button" variant="outline" onClick={save} disabled={!newBranch.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Ekle
          </Button>
        </div>
      ) : null}
    </div>
  );
}
