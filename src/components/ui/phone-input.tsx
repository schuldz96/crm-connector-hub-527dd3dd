import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Search } from 'lucide-react';

interface Country {
  code: string;   // ISO 3166-1 alpha-2
  name: string;
  dial: string;   // e.g. "+55"
  flag: string;   // emoji flag
}

const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brasil',           dial: '+55',  flag: '🇧🇷' },
  { code: 'US', name: 'Estados Unidos',   dial: '+1',   flag: '🇺🇸' },
  { code: 'PT', name: 'Portugal',         dial: '+351', flag: '🇵🇹' },
  { code: 'AR', name: 'Argentina',        dial: '+54',  flag: '🇦🇷' },
  { code: 'CL', name: 'Chile',            dial: '+56',  flag: '🇨🇱' },
  { code: 'CO', name: 'Colômbia',         dial: '+57',  flag: '🇨🇴' },
  { code: 'MX', name: 'México',           dial: '+52',  flag: '🇲🇽' },
  { code: 'UY', name: 'Uruguai',          dial: '+598', flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguai',         dial: '+595', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru',             dial: '+51',  flag: '🇵🇪' },
  { code: 'BO', name: 'Bolívia',          dial: '+591', flag: '🇧🇴' },
  { code: 'EC', name: 'Equador',          dial: '+593', flag: '🇪🇨' },
  { code: 'VE', name: 'Venezuela',        dial: '+58',  flag: '🇻🇪' },
  { code: 'GB', name: 'Reino Unido',      dial: '+44',  flag: '🇬🇧' },
  { code: 'DE', name: 'Alemanha',         dial: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'França',           dial: '+33',  flag: '🇫🇷' },
  { code: 'ES', name: 'Espanha',          dial: '+34',  flag: '🇪🇸' },
  { code: 'IT', name: 'Itália',           dial: '+39',  flag: '🇮🇹' },
  { code: 'JP', name: 'Japão',            dial: '+81',  flag: '🇯🇵' },
  { code: 'CN', name: 'China',            dial: '+86',  flag: '🇨🇳' },
  { code: 'IN', name: 'Índia',            dial: '+91',  flag: '🇮🇳' },
  { code: 'AU', name: 'Austrália',        dial: '+61',  flag: '🇦🇺' },
  { code: 'CA', name: 'Canadá',           dial: '+1',   flag: '🇨🇦' },
  { code: 'IL', name: 'Israel',           dial: '+972', flag: '🇮🇱' },
  { code: 'AE', name: 'Emirados Árabes',  dial: '+971', flag: '🇦🇪' },
  { code: 'ZA', name: 'África do Sul',    dial: '+27',  flag: '🇿🇦' },
  { code: 'NG', name: 'Nigéria',          dial: '+234', flag: '🇳🇬' },
  { code: 'KR', name: 'Coreia do Sul',    dial: '+82',  flag: '🇰🇷' },
  { code: 'RU', name: 'Rússia',           dial: '+7',   flag: '🇷🇺' },
  { code: 'PL', name: 'Polônia',          dial: '+48',  flag: '🇵🇱' },
];

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  className?: string;
}

export default function PhoneInput({ value, onChange, placeholder, className }: PhoneInputProps) {
  // Parse existing value to extract country + number
  const parsed = parsePhone(value);
  const [country, setCountry] = useState<Country>(parsed.country);
  const [number, setNumber] = useState(parsed.number);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync when value prop changes externally
  useEffect(() => {
    const p = parsePhone(value);
    setCountry(p.country);
    setNumber(p.number);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const handleNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setNumber(digits);
    onChange(digits ? `${country.dial}${digits}` : '');
  };

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    onChange(number ? `${c.dial}${number}` : '');
  };

  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <div className={cn('flex items-center gap-0 relative', className)}>
      {/* Country selector */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 px-2.5 h-10 rounded-l-md border border-r-0 border-border bg-muted hover:bg-muted/80 transition-colors text-sm"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="text-xs text-muted-foreground font-mono">{country.dial}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-[260px] max-h-[280px] rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar país..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[220px]">
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors',
                    c.code === country.code
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-left truncate">{c.name}</span>
                  <span className="text-muted-foreground font-mono">{c.dial}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum país encontrado</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        type="tel"
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        placeholder={placeholder || '11 99999-0000'}
        className="flex-1 h-10 px-3 rounded-r-md border border-border bg-background text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 font-mono"
      />
    </div>
  );
}

/** Parse a full phone string like "+5511999990000" into country + local number */
function parsePhone(value: string): { country: Country; number: string } {
  const defaultCountry = COUNTRIES[0]; // BR
  if (!value) return { country: defaultCountry, number: '' };

  const clean = value.replace(/\s+/g, '').replace(/[()-]/g, '');

  // Try matching known dial codes (longest first)
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (clean.startsWith(c.dial)) {
      return { country: c, number: clean.slice(c.dial.length) };
    }
  }

  // No match — assume BR with raw digits
  const digits = clean.replace(/\D/g, '');
  return { country: defaultCountry, number: digits };
}
