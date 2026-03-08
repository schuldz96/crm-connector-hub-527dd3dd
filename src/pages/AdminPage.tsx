import { useState } from 'react';
import { MOCK_USERS, MOCK_INTEGRATIONS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Users, Plug2, Settings2, Building2, Key, Bell,
  ChevronRight, CheckCircle2, AlertCircle, Save, Eye, EyeOff,
  TrendingUp, Globe, Palette, Database, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_SECTIONS = [
  { id: 'company', label: 'Empresa', icon: Building2 },
  { id: 'users', label: 'Usuários & Permissões', icon: Users },
  { id: 'integrations', label: 'Integrações', icon: Plug2 },
  { id: 'security', label: 'Segurança & RLS', icon: Lock },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'billing', label: 'Plano & Faturamento', icon: TrendingUp },
];

export default function AdminPage() {
  const [section, setSection] = useState('company');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const toggleKey = (k: string) => setShowKey(prev => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Configurações globais da plataforma</p>
      </div>

      <div className="flex gap-6">
        {/* Menu */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {ADMIN_SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn('w-full nav-item', section === s.id && 'active')}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                <span>{s.label}</span>
                {section !== s.id && <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/50" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {section === 'company' && (
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-semibold text-lg">Configurações da Empresa</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nome da Empresa', value: 'Deal Intel', placeholder: 'Sua empresa' },
                  { label: 'Domínio', value: 'dealintel.com.br', placeholder: 'dominio.com.br' },
                  { label: 'CNPJ', value: '', placeholder: '00.000.000/0001-00' },
                  { label: 'Email de Contato', value: 'admin@dealintel.com.br', placeholder: 'admin@empresa.com' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-medium block mb-1.5">{f.label}</label>
                    <Input defaultValue={f.value} placeholder={f.placeholder} className="h-9 text-sm bg-secondary border-border" />
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <Button size="sm" className="bg-gradient-primary text-xs">
                  <Save className="w-3 h-3 mr-1" /> Salvar Alterações
                </Button>
              </div>
            </div>
          )}

          {section === 'users' && (
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Usuários & Permissões</h2>
                <Button size="sm" className="text-xs bg-gradient-primary h-8">+ Convidar</Button>
              </div>
              <div className="space-y-2">
                {MOCK_USERS.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <select className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground">
                      <option value="admin" selected={u.role === 'admin'}>Admin</option>
                      <option value="director" selected={u.role === 'director'}>Diretor</option>
                      <option value="supervisor" selected={u.role === 'supervisor'}>Supervisor</option>
                      <option value="member" selected={u.role === 'member'}>Vendedor</option>
                    </select>
                    <span className={cn('w-2 h-2 rounded-full', u.status === 'active' ? 'bg-success' : 'bg-muted-foreground')} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'integrations' && (
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-semibold text-lg">Credenciais de Integração</h2>
              <div className="space-y-4">
                {[
                  { key: 'openai', label: 'OpenAI API Key', placeholder: 'sk-proj-...', icon: '🤖' },
                  { key: 'evolution', label: 'Evolution API Token', placeholder: 'Bearer token...', icon: '💬' },
                  { key: 'n8n', label: 'N8N Webhook URL', placeholder: 'https://n8n.seudominio.com/webhook/...', icon: '⚡' },
                  { key: 'hubspot', label: 'HubSpot Access Token', placeholder: 'pat-na1-...', icon: '🧡' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium block mb-1.5">
                      {f.icon} {f.label}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKey[f.key] ? 'text' : 'password'}
                          placeholder={f.placeholder}
                          className="h-9 text-xs bg-secondary border-border pr-10"
                        />
                        <button onClick={() => toggleKey(f.key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showKey[f.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs border-border h-9">Testar</Button>
                    </div>
                  </div>
                ))}
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground">🔐 Todas as chaves são armazenadas de forma criptografada. Nunca são expostas no client-side.</p>
                </div>
                <Button size="sm" className="bg-gradient-primary text-xs">
                  <Save className="w-3 h-3 mr-1" /> Salvar Credenciais
                </Button>
              </div>
            </div>
          )}

          {section === 'security' && (
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-semibold text-lg">Segurança & Row Level Security</h2>
              <div className="space-y-3">
                {[
                  { label: 'RLS habilitado nas tabelas', status: true, desc: 'Usuários só acessam dados autorizados pelo seu role' },
                  { label: 'Auth 2FA disponível', status: false, desc: 'Autenticação de dois fatores para maior segurança' },
                  { label: 'Logs de auditoria', status: true, desc: 'Registro de todas as ações críticas' },
                  { label: 'Sessões com expiração', status: true, desc: 'Tokens expiram após 7 dias de inatividade' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                    {item.status ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full border flex-shrink-0', item.status ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20')}>
                      {item.status ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(section === 'notifications' || section === 'billing') && (
            <div className="glass-card p-6 text-center py-16">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
                {section === 'notifications' ? <Bell className="w-6 h-6 text-muted-foreground" /> : <TrendingUp className="w-6 h-6 text-muted-foreground" />}
              </div>
              <h3 className="font-display font-semibold mb-2">{section === 'notifications' ? 'Notificações' : 'Plano & Faturamento'}</h3>
              <p className="text-sm text-muted-foreground">Esta seção está em desenvolvimento.</p>
              <Button size="sm" className="mt-4 bg-gradient-primary text-xs">Em Breve</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
