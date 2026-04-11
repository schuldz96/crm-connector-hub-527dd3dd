import { useEffect, useRef, useState } from 'react';
import { useOrgNavigate } from '@/hooks/useOrgNavigate';
import { Camera, RotateCcw, Save, Settings2, Shield, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MyProfilePage() {
  const { user, canAccess, updateProfile } = useAuth();
  const navigate = useOrgNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;
  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`;

  useEffect(() => {
    setName(user.name);
    setAvatarPreview(user.avatar || fallbackAvatar);
  }, [user.name, user.avatar, fallbackAvatar]);

  const handlePickAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Formato inválido', description: 'Selecione uma imagem válida.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Use uma imagem de até 2MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const hasChanges = name.trim() !== user.name || avatarPreview !== (user.avatar || fallbackAvatar);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Informe um nome para salvar.' });
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ name: trimmedName, avatar: avatarPreview });
      setIsSaving(false);
      toast({ title: 'Perfil atualizado', description: 'Suas alterações foram salvas.' });
    } catch (e: any) {
      setIsSaving(false);
      toast({ variant: 'destructive', title: 'Erro ao salvar perfil', description: e?.message || 'Tente novamente.' });
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="glass-card p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={avatarPreview || fallbackAvatar}
            alt={user.name}
            className="w-16 h-16 rounded-2xl border border-border"
          />
          <div>
            <h1 className="text-2xl font-display font-bold">{name || user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="inline-flex mt-2 text-xs px-2 py-1 rounded-full border bg-primary/10 border-primary/30 text-primary">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Nome</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="h-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePickAvatar(e.target.files?.[0])}
            />
            <Button variant="outline" className="h-8 text-xs" onClick={() => fileRef.current?.click()}>
              <Camera className="w-3.5 h-3.5 mr-1.5" /> Alterar foto
            </Button>
            <Button variant="ghost" className="h-8 text-xs" onClick={() => setAvatarPreview(fallbackAvatar)}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restaurar padrão
            </Button>
            <Button className="h-8 text-xs ml-auto" disabled={!hasChanges || isSaving} onClick={handleSave}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" className="justify-start" onClick={() => navigate('/users')}>
            <Users className="w-4 h-4 mr-2" /> Usuários
          </Button>
          {canAccess('admin') && (
            <Button variant="outline" className="justify-start" onClick={() => navigate('/admin')}>
              <Shield className="w-4 h-4 mr-2" /> Administração
            </Button>
          )}
          <Button variant="outline" className="justify-start" onClick={() => navigate('/ai-config')}>
            <Settings2 className="w-4 h-4 mr-2" /> Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
