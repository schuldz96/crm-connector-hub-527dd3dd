// Types for the entire application

export type UserRole = 'admin' | 'director' | 'supervisor' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  teamId?: string;
  company: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  supervisorId: string;
  memberIds: string[];
  companyId: string;
  goal?: number;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  logo?: string;
  plan: 'starter' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number; // minutes
  sellerId: string;
  sellerName: string;
  clientName: string;
  clientEmail?: string;
  companyId?: string;
  dealId?: string;
  meetLink?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  score?: number;
  aiAnalyzed: boolean;
  teamId: string;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  meetingId: string;
  evaluatorId: string;
  rapport: number;
  discovery: number;
  presentation: number;
  objections: number;
  nextSteps: number;
  totalScore: number;
  notes?: string;
  aiSummary?: string;
  aiInsights?: string;
  createdAt: string;
}

export interface WhatsAppInstance {
  id: string;
  name: string;
  phone?: string;
  status: 'connected' | 'disconnected' | 'connecting';
  userId: string;
  teamId?: string;
  qrCode?: string;
  lastSeen?: string;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  instanceId: string;
  conversationId: string;
  from: string;
  to: string;
  body: string;
  type: 'text' | 'image' | 'audio' | 'document';
  direction: 'inbound' | 'outbound';
  timestamp: string;
}

export interface Conversation {
  id: string;
  instanceId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedTo?: string;
  tags: string[];
  score?: number;
  aiAnalyzed: boolean;
}

export interface Integration {
  id: string;
  type: 'google_calendar' | 'google_meet' | 'hubspot' | 'openai' | 'evolution_api' | 'n8n';
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  configuredAt?: string;
  config?: Record<string, string>;
}

export interface KPI {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

export interface AutomationPayload {
  event: string;
  data: Record<string, unknown>;
  userId: string;
  timestamp: string;
}
