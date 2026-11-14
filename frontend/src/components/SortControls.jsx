import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Label } from './ui/label';

export default function SortControls({ sortOptions, currentSort, onSortChange }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort-select">Sortieren nach:</Label>
      <Select value={currentSort} onValueChange={onSortChange}>
        <SelectTrigger id="sort-select" className="w-64" aria-label="Sortierung auswählen">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
