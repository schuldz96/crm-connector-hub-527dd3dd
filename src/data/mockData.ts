import type {
  User, Team, Area, Meeting, Evaluation, WhatsAppInstance,
  Conversation, WhatsAppMessage, Integration
} from '@/types';

// Clean baseline: no fictitious seed data.
// Use Admin/Users/Teams flows to start adding real records.
export const MOCK_AREAS: Area[] = [];
export const MOCK_USERS: User[] = [];
export const MOCK_TEAMS: Team[] = [];
export const MOCK_MEETINGS: Meeting[] = [];
export const MOCK_EVALUATIONS: Evaluation[] = [];
export const MOCK_WHATSAPP_INSTANCES: WhatsAppInstance[] = [];
export const MOCK_CONVERSATIONS: Conversation[] = [];
export const MOCK_MESSAGES: Record<string, WhatsAppMessage[]> = {};
export const MOCK_INTEGRATIONS: Integration[] = [];

export const CHART_DATA = {
  meetingsPerMonth: [] as Array<{ month: string; meetings: number; conversions: number }>,
  scoreEvolution: [] as Array<{ week: string; julia: number; diego: number; mariana: number }>,
  conversionByTeam: [] as Array<{ name: string; value: number; fill: string }>,
};

