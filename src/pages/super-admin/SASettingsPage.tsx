import { useState, useEffect } from 'react';
import { getPlatformConfig, updatePlatformConfig } from '@/lib/superAdminService';
import type { PlatformConfig } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, Settings, Save, X, Pencil } from 'lucide-react';

export default function SASettingsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    setError('');
    try {
      const data = await getPlatformConfig();
      setConfigs(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(config: PlatformConfig) {
    setEditingId(config.id);
    setEditValue(config.valor ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  async function handleSave(id: string) {
    setSaving(true);
    try {
      await updatePlatformConfig(id, editValue);
      toast({ title: 'Configuracao atualizada com sucesso' });
      setEditingId(null);
      setEditValue('');
      await loadConfigs();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const typeColors: Record<string, string> = {
    string: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    number: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    boolean: 'bg-green-500/10 text-green-400 border-green-500/20',
    json: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-red-500" />
          Configuracoes da Plataforma
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {configs.length} parametros de configuracao
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead className="w-24">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma configuracao encontrada.
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-mono text-sm font-medium">{config.chave}</TableCell>
                  <TableCell>
                    {editingId === config.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-input border-border h-8 text-sm max-w-[300px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(config.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSave(config.id)}
                          disabled={saving}
                          className="h-8 w-8 p-0"
                        >
                          {saving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3 text-green-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground font-mono max-w-[300px] truncate block">
                        {config.valor ?? '(vazio)'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={typeColors[config.tipo] ?? typeColors.string}>
                      {config.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {config.descricao || '—'}
                  </TableCell>
                  <TableCell>
                    {editingId !== config.id && (
                      <Button variant="ghost" size="sm" onClick={() => startEdit(config)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
