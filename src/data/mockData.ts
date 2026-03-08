// Mock data for the entire application

import type {
  User, Team, Meeting, Evaluation, WhatsAppInstance,
  Conversation, WhatsAppMessage, Integration
} from '@/types';

export const MOCK_USERS: User[] = [
  { id: 'usr_001', name: 'Carlos Mendes', email: 'carlos@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos', role: 'admin', teamId: 'team_001', company: 'Deal Intel', status: 'active', createdAt: '2024-01-01' },
  { id: 'usr_002', name: 'Ana Souza', email: 'ana@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana', role: 'director', teamId: 'team_001', company: 'Deal Intel', status: 'active', createdAt: '2024-01-15' },
  { id: 'usr_003', name: 'Rafael Torres', email: 'rafael@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rafael', role: 'supervisor', teamId: 'team_001', company: 'Deal Intel', status: 'active', createdAt: '2024-02-01' },
  { id: 'usr_004', name: 'Julia Lima', email: 'julia@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julia', role: 'member', teamId: 'team_001', company: 'Deal Intel', status: 'active', createdAt: '2024-02-10' },
  { id: 'usr_005', name: 'Diego Alves', email: 'diego@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diego', role: 'member', teamId: 'team_002', company: 'Deal Intel', status: 'active', createdAt: '2024-02-15' },
  { id: 'usr_006', name: 'Mariana Costa', email: 'mariana@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mariana', role: 'member', teamId: 'team_002', company: 'Deal Intel', status: 'active', createdAt: '2024-03-01' },
  { id: 'usr_007', name: 'Felipe Rocha', email: 'felipe@dealintel.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felipe', role: 'member', teamId: 'team_001', company: 'Deal Intel', status: 'inactive', createdAt: '2024-03-05' },
];

export const MOCK_TEAMS: Team[] = [
  { id: 'team_001', name: 'Equipe Alpha', supervisorId: 'usr_003', memberIds: ['usr_004', 'usr_007'], companyId: 'comp_001', goal: 50, createdAt: '2024-01-01' },
  { id: 'team_002', name: 'Equipe Beta', supervisorId: 'usr_002', memberIds: ['usr_005', 'usr_006'], companyId: 'comp_001', goal: 40, createdAt: '2024-01-15' },
];

export const MOCK_MEETINGS: Meeting[] = [
  { id: 'mtg_001', title: 'Demo Produto - Acme Corp', date: '2024-11-20T14:00:00', duration: 45, sellerId: 'usr_004', sellerName: 'Julia Lima', clientName: 'Roberto Faria', clientEmail: 'roberto@acme.com', meetLink: 'https://meet.google.com/abc-def-ghi', status: 'completed', score: 87, aiAnalyzed: true, teamId: 'team_001', createdAt: '2024-11-20' },
  { id: 'mtg_002', title: 'Apresentação Inicial - TechFlow', date: '2024-11-21T10:00:00', duration: 30, sellerId: 'usr_005', sellerName: 'Diego Alves', clientName: 'Patrícia Nunes', clientEmail: 'patricia@techflow.com', meetLink: 'https://meet.google.com/xyz-abc-def', status: 'completed', score: 72, aiAnalyzed: true, teamId: 'team_002', createdAt: '2024-11-21' },
  { id: 'mtg_003', title: 'Follow-up - StartupX', date: '2024-11-22T15:30:00', duration: 60, sellerId: 'usr_004', sellerName: 'Julia Lima', clientName: 'Marcos Vieira', clientEmail: 'marcos@startupx.io', meetLink: 'https://meet.google.com/pqr-stu-vwx', status: 'completed', score: 91, aiAnalyzed: true, teamId: 'team_001', createdAt: '2024-11-22' },
  { id: 'mtg_004', title: 'Qualificação - Nexus SA', date: '2024-11-23T09:00:00', duration: 25, sellerId: 'usr_006', sellerName: 'Mariana Costa', clientName: 'Ana Lima', clientEmail: 'ana@nexus.com.br', status: 'completed', score: 65, aiAnalyzed: false, teamId: 'team_002', createdAt: '2024-11-23' },
  { id: 'mtg_005', title: 'Demo Avançada - GlobalTech', date: '2024-11-25T11:00:00', duration: 50, sellerId: 'usr_005', sellerName: 'Diego Alves', clientName: 'Carlos Stein', clientEmail: 'carlos@globaltech.com', meetLink: 'https://meet.google.com/mno-pqr-stu', status: 'scheduled', aiAnalyzed: false, teamId: 'team_002', createdAt: '2024-11-24' },
  { id: 'mtg_006', title: 'Proposta Comercial - InfoSoft', date: '2024-11-26T16:00:00', duration: 40, sellerId: 'usr_004', sellerName: 'Julia Lima', clientName: 'Beatriz Santos', clientEmail: 'beatriz@infosoft.com.br', status: 'scheduled', aiAnalyzed: false, teamId: 'team_001', createdAt: '2024-11-24' },
  { id: 'mtg_007', title: 'Negociação - Empresa XYZ', date: '2024-11-19T14:00:00', duration: 35, sellerId: 'usr_006', sellerName: 'Mariana Costa', clientName: 'Gustavo Prado', clientEmail: 'gustavo@xyz.com', status: 'no_show', aiAnalyzed: false, teamId: 'team_002', createdAt: '2024-11-19' },
];

export const MOCK_EVALUATIONS: Evaluation[] = [
  { id: 'eval_001', meetingId: 'mtg_001', evaluatorId: 'usr_003', rapport: 90, discovery: 85, presentation: 88, objections: 82, nextSteps: 90, totalScore: 87, aiSummary: 'Excelente reunião. Julia demonstrou alto nível de rapport e conduziu bem a descoberta de dores. Apresentação fluida do produto com boa cobertura dos principais benefícios.', aiInsights: 'Ponto de melhoria: tratamento de objeções sobre preço pode ser mais direto. Próximos passos bem definidos.', createdAt: '2024-11-20' },
  { id: 'eval_002', meetingId: 'mtg_002', evaluatorId: 'usr_002', rapport: 75, discovery: 70, presentation: 72, objections: 68, nextSteps: 75, totalScore: 72, aiSummary: 'Reunião dentro do esperado. Descoberta poderia ser mais aprofundada com perguntas abertas.', aiInsights: 'Sugestão: usar metodologia SPIN para qualificação mais efetiva.', createdAt: '2024-11-21' },
  { id: 'eval_003', meetingId: 'mtg_003', evaluatorId: 'usr_003', rapport: 95, discovery: 90, presentation: 92, objections: 88, nextSteps: 90, totalScore: 91, aiSummary: 'Reunião excepcional. Melhor performance do mês para Julia.', aiInsights: 'Continue utilizando a mesma abordagem consultiva. Benchmark para o time.', createdAt: '2024-11-22' },
];

export const MOCK_WHATSAPP_INSTANCES: WhatsAppInstance[] = [
  { id: 'wa_001', name: 'Vendas Principal', phone: '+55 11 99999-0001', status: 'connected', userId: 'usr_004', teamId: 'team_001', lastSeen: '2024-11-24T16:30:00', createdAt: '2024-10-01' },
  { id: 'wa_002', name: 'SDR Team Beta', phone: '+55 11 99999-0002', status: 'connected', userId: 'usr_005', teamId: 'team_002', lastSeen: '2024-11-24T15:00:00', createdAt: '2024-10-15' },
  { id: 'wa_003', name: 'Closer CS', phone: '+55 21 99999-0003', status: 'disconnected', userId: 'usr_006', teamId: 'team_002', lastSeen: '2024-11-22T10:00:00', createdAt: '2024-11-01' },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 'conv_001', instanceId: 'wa_001', contactName: 'Roberto Faria', contactPhone: '+55 11 91234-5678', lastMessage: 'Pode me enviar a proposta comercial?', lastMessageAt: '2024-11-24T16:20:00', unreadCount: 2, assignedTo: 'usr_004', tags: ['quente', 'demo'], score: 82, aiAnalyzed: true },
  { id: 'conv_002', instanceId: 'wa_001', contactName: 'Patricia Nunes', contactPhone: '+55 11 98765-4321', lastMessage: 'Ótima apresentação! Vou levar para o board.', lastMessageAt: '2024-11-24T14:10:00', unreadCount: 0, assignedTo: 'usr_004', tags: ['morno'], score: 75, aiAnalyzed: true },
  { id: 'conv_003', instanceId: 'wa_002', contactName: 'Marcos Vieira', contactPhone: '+55 21 97654-3210', lastMessage: 'Quando posso agendar outra call?', lastMessageAt: '2024-11-24T11:30:00', unreadCount: 1, assignedTo: 'usr_005', tags: ['quente', 'fechamento'], score: 91, aiAnalyzed: true },
  { id: 'conv_004', instanceId: 'wa_002', contactName: 'Ana Lima', contactPhone: '+55 31 96543-2109', lastMessage: 'Preciso pensar melhor sobre o investimento.', lastMessageAt: '2024-11-23T17:00:00', unreadCount: 0, assignedTo: 'usr_005', tags: ['frio', 'objeção-preço'], score: 40, aiAnalyzed: false },
  { id: 'conv_005', instanceId: 'wa_003', contactName: 'Carlos Stein', contactPhone: '+55 11 95432-1098', lastMessage: 'Fechamos! Me manda o contrato.', lastMessageAt: '2024-11-24T09:00:00', unreadCount: 3, assignedTo: 'usr_006', tags: ['fechado'], aiAnalyzed: false },
];

export const MOCK_MESSAGES: Record<string, WhatsAppMessage[]> = {
  conv_001: [
    { id: 'msg_001', instanceId: 'wa_001', conversationId: 'conv_001', from: '+55 11 91234-5678', to: '+55 11 99999-0001', body: 'Olá! Tudo bem? Vi que vocês têm uma solução interessante.', type: 'text', direction: 'inbound', timestamp: '2024-11-24T15:00:00' },
    { id: 'msg_002', instanceId: 'wa_001', conversationId: 'conv_001', from: '+55 11 99999-0001', to: '+55 11 91234-5678', body: 'Olá Roberto! Tudo ótimo sim. Que bom que se interessou! Posso te explicar melhor nossa solução?', type: 'text', direction: 'outbound', timestamp: '2024-11-24T15:05:00' },
    { id: 'msg_003', instanceId: 'wa_001', conversationId: 'conv_001', from: '+55 11 91234-5678', to: '+55 11 99999-0001', body: 'Claro! Qual o diferencial de vocês?', type: 'text', direction: 'inbound', timestamp: '2024-11-24T15:10:00' },
    { id: 'msg_004', instanceId: 'wa_001', conversationId: 'conv_001', from: '+55 11 99999-0001', to: '+55 11 91234-5678', body: 'Nossa plataforma usa IA para analisar reuniões e dar feedbacks automáticos para sua equipe. Taxa de conversão média aumenta em 35%!', type: 'text', direction: 'outbound', timestamp: '2024-11-24T15:15:00' },
    { id: 'msg_005', instanceId: 'wa_001', conversationId: 'conv_001', from: '+55 11 91234-5678', to: '+55 11 99999-0001', body: 'Pode me enviar a proposta comercial?', type: 'text', direction: 'inbound', timestamp: '2024-11-24T16:20:00' },
  ],
};

export const MOCK_INTEGRATIONS: Integration[] = [
  { id: 'int_001', type: 'google_calendar', name: 'Google Calendar', status: 'connected', configuredAt: '2024-10-01' },
  { id: 'int_002', type: 'google_meet', name: 'Google Meet', status: 'connected', configuredAt: '2024-10-01' },
  { id: 'int_003', type: 'hubspot', name: 'HubSpot CRM', status: 'disconnected' },
  { id: 'int_004', type: 'openai', name: 'OpenAI API', status: 'connected', configuredAt: '2024-10-15' },
  { id: 'int_005', type: 'evolution_api', name: 'Evolution API (WhatsApp)', status: 'connected', configuredAt: '2024-11-01' },
  { id: 'int_006', type: 'n8n', name: 'N8N Automações', status: 'error', configuredAt: '2024-11-10' },
];

export const CHART_DATA = {
  meetingsPerMonth: [
    { month: 'Jun', meetings: 34, conversions: 12 },
    { month: 'Jul', meetings: 41, conversions: 18 },
    { month: 'Ago', meetings: 38, conversions: 15 },
    { month: 'Set', meetings: 52, conversions: 23 },
    { month: 'Out', meetings: 61, conversions: 28 },
    { month: 'Nov', meetings: 47, conversions: 21 },
  ],
  scoreEvolution: [
    { week: 'S1', julia: 72, diego: 68, mariana: 70 },
    { week: 'S2', julia: 78, diego: 72, mariana: 65 },
    { week: 'S3', julia: 82, diego: 75, mariana: 73 },
    { week: 'S4', julia: 87, diego: 79, mariana: 78 },
  ],
  conversionByTeam: [
    { name: 'Equipe Alpha', value: 42, fill: 'hsl(210 100% 56%)' },
    { name: 'Equipe Beta', value: 35, fill: 'hsl(168 80% 42%)' },
  ],
};
