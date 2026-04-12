import type { LPBlock } from './lp-editor-types';
import { DEFAULT_BLOCK_STYLES } from './lp-editor-types';

const S = () => ({ ...DEFAULT_BLOCK_STYLES });

export interface LPTemplate {
  id: string;
  name: string;
  description: string;
  preview: string; // emoji
  blocks: LPBlock[];
}

export const LP_TEMPLATES: LPTemplate[] = [
  {
    id: 'blank',
    name: 'Em branco',
    description: 'Comece do zero',
    preview: '📄',
    blocks: [],
  },
  {
    id: 'saas-product',
    name: 'Produto SaaS',
    description: 'LP para produto de software com hero, features, CTA e formulário',
    preview: '🚀',
    blocks: [
      {
        id: 't1-hero', type: 'hero', styles: S(),
        props: {
          headline: 'Transforme suas vendas com inteligência artificial',
          subheadline: 'Analise reuniões, WhatsApp e ligações automaticamente. Aumente a conversão do seu time comercial com coaching de IA em tempo real.',
          bgColor: '#0f172a', bgImage: '', bgOverlay: 50, textColor: '#ffffff', alignment: 'center', height: 'large',
        },
      },
      {
        id: 't1-cols', type: 'columns', styles: S(),
        props: {
          layout: '33-33-33', gap: 24, bgColor: '#ffffff', bgImage: '', bgOverlay: 0, textColor: '#0f172a', padding: 64,
          columns: [
            { verticalAlign: 'top', bgColor: '', padding: 24, items: [
              { id: 'c1', type: 'icon', content: '🎯', url: '', color: '', bgColor: '', size: 'lg', alignment: 'center', bold: false, italic: false },
              { id: 'c2', type: 'heading', content: 'Análise Automática', url: '', color: '', bgColor: '', size: 'md', alignment: 'center', bold: true, italic: false },
              { id: 'c3', type: 'text', content: 'Avalie cada interação de vendas com metodologias como SPIN, Sandler e MEDDIC automaticamente.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: false, italic: false },
            ]},
            { verticalAlign: 'top', bgColor: '', padding: 24, items: [
              { id: 'c4', type: 'icon', content: '📊', url: '', color: '', bgColor: '', size: 'lg', alignment: 'center', bold: false, italic: false },
              { id: 'c5', type: 'heading', content: 'Dashboard de Performance', url: '', color: '', bgColor: '', size: 'md', alignment: 'center', bold: true, italic: false },
              { id: 'c6', type: 'text', content: 'Acompanhe métricas de desempenho do time comercial em tempo real com dashboards intuitivos.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: false, italic: false },
            ]},
            { verticalAlign: 'top', bgColor: '', padding: 24, items: [
              { id: 'c7', type: 'icon', content: '🤖', url: '', color: '', bgColor: '', size: 'lg', alignment: 'center', bold: false, italic: false },
              { id: 'c8', type: 'heading', content: 'Coaching com IA', url: '', color: '', bgColor: '', size: 'md', alignment: 'center', bold: true, italic: false },
              { id: 'c9', type: 'text', content: 'Receba feedback personalizado e sugestões de melhoria baseadas em metodologias de vendas comprovadas.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: false, italic: false },
            ]},
          ],
        },
      },
      {
        id: 't1-section', type: 'section', styles: S(),
        props: {
          bgColor: '#f1f5f9', bgImage: '', bgOverlay: 0, paddingY: 64, paddingX: 24,
          title: 'Por que escolher a LTX?', subtitle: 'Mais de 10 metodologias de vendas integradas para avaliar e treinar seu time.',
          textColor: '#0f172a', alignment: 'center', maxWidth: 'lg',
        },
      },
      {
        id: 't1-cols2', type: 'columns', styles: S(),
        props: {
          layout: '50-50', gap: 32, bgColor: '#f1f5f9', bgImage: '', bgOverlay: 0, textColor: '#0f172a', padding: 48,
          columns: [
            { verticalAlign: 'center', bgColor: '', padding: 24, items: [
              { id: 'd1', type: 'heading', content: 'Integração completa', url: '', color: '', bgColor: '', size: 'lg', alignment: 'left', bold: true, italic: false },
              { id: 'd2', type: 'text', content: 'Conecte Google Meet, WhatsApp e suas ferramentas favoritas. Tudo centralizado em uma única plataforma.', url: '', color: '', bgColor: '', size: 'md', alignment: 'left', bold: false, italic: false },
              { id: 'd3', type: 'list', content: 'Google Meet — transcrição automática\nWhatsApp — análise de conversas\nCRM integrado — pipeline visual\nIA multi-agente — avaliação contínua', url: '', color: '', bgColor: '', size: 'sm', alignment: 'left', bold: false, italic: false },
            ]},
            { verticalAlign: 'center', bgColor: '', padding: 24, items: [
              { id: 'd4', type: 'heading', content: 'Resultados comprovados', url: '', color: '', bgColor: '', size: 'lg', alignment: 'left', bold: true, italic: false },
              { id: 'd5', type: 'text', content: 'Empresas que usam coaching de vendas com IA reportam até 30% de aumento na taxa de conversão.', url: '', color: '', bgColor: '', size: 'md', alignment: 'left', bold: false, italic: false },
              { id: 'd6', type: 'button', content: 'Agendar demonstração', url: '#contato', color: '#6366f1', bgColor: '', size: 'lg', alignment: 'left', bold: false, italic: false },
            ]},
          ],
        },
      },
      {
        id: 't1-form', type: 'form', styles: S(),
        props: {
          formId: '', title: 'Comece agora mesmo', subtitle: 'Preencha seus dados e entraremos em contato em até 24 horas.',
          buttonText: 'Quero uma demonstração', buttonColor: '#6366f1', bgColor: '#0f172a', textColor: '#ffffff', layout: 'stacked',
        },
      },
    ],
  },
  {
    id: 'lead-capture',
    name: 'Captura de Leads',
    description: 'LP focada em conversão com countdown e formulário',
    preview: '📋',
    blocks: [
      {
        id: 't2-hero', type: 'hero', styles: S(),
        props: {
          headline: 'Oferta exclusiva por tempo limitado',
          subheadline: 'Garanta acesso ao melhor plano com condições especiais. Vagas limitadas!',
          bgColor: '#1e1b4b', bgImage: '', bgOverlay: 0, textColor: '#ffffff', alignment: 'center', height: 'medium',
        },
      },
      {
        id: 't2-countdown', type: 'countdown', styles: S(),
        props: {
          endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          title: 'Esta oferta expira em', bgColor: '#dc2626', textColor: '#ffffff',
          showDays: true, showHours: true, showMinutes: true, showSeconds: true,
        },
      },
      {
        id: 't2-form', type: 'form', styles: S(),
        props: {
          formId: '', title: 'Garanta sua vaga', subtitle: 'Preencha abaixo para garantir o preço promocional.',
          buttonText: 'Garantir minha vaga', buttonColor: '#dc2626', bgColor: '#ffffff', textColor: '#0f172a', layout: 'stacked',
        },
      },
    ],
  },
  {
    id: 'event-registration',
    name: 'Evento / Webinar',
    description: 'LP para inscrição em evento com agenda e palestrantes',
    preview: '🎤',
    blocks: [
      {
        id: 't3-hero', type: 'hero', styles: S(),
        props: {
          headline: 'Webinar: O Futuro das Vendas com IA',
          subheadline: 'Aprenda como usar inteligência artificial para escalar suas operações comerciais. 100% gratuito e online.',
          bgColor: '#312e81', bgImage: '', bgOverlay: 0, textColor: '#ffffff', alignment: 'center', height: 'medium',
        },
      },
      {
        id: 't3-section', type: 'section', styles: S(),
        props: {
          bgColor: '#ffffff', bgImage: '', bgOverlay: 0, paddingY: 48, paddingX: 24,
          title: 'O que você vai aprender', subtitle: '',
          textColor: '#0f172a', alignment: 'center', maxWidth: 'lg',
        },
      },
      {
        id: 't3-cols', type: 'columns', styles: S(),
        props: {
          layout: '33-33-33', gap: 20, bgColor: '#ffffff', bgImage: '', bgOverlay: 0, textColor: '#0f172a', padding: 32,
          columns: [
            { verticalAlign: 'top', bgColor: '#f8fafc', padding: 20, items: [
              { id: 'e1', type: 'icon', content: '📈', url: '', color: '', bgColor: '', size: 'lg', alignment: 'center', bold: false, italic: false },
              { id: 'e2', type: 'heading', content: 'Métricas que importam', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: true, italic: false },
              { id: 'e3', type: 'text', content: 'Como identificar os KPIs certos para medir a performance do time.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: false, italic: false },
            ]},
            { verticalAlign: 'top', bgColor: '#f8fafc', padding: 20, items: [
              { id: 'e4', type: 'icon', content: '🧠', url: '', color: '', bgColor: '', size: 'lg', alignment: 'center', bold: false, italic: false },
              { id: 'e5', type: 'heading', content: 'IA no dia a dia', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: true, italic: false },
              { id: 'e6', type: 'text', content: 'Casos reais de como empresas estão usando IA para treinar vendedores.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: false, italic: false },
            ]},
            { verticalAlign: 'top', bgColor: '#f8fafc', padding: 20, items: [
              { id: 'e7', type: 'icon', content: '🏆', url: '', color: '', bgColor: '', size: 'lg', alignment: 'center', bold: false, italic: false },
              { id: 'e8', type: 'heading', content: 'Playbook vencedor', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: true, italic: false },
              { id: 'e9', type: 'text', content: 'Monte um playbook de vendas baseado em dados e metodologias.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'center', bold: false, italic: false },
            ]},
          ],
        },
      },
      {
        id: 't3-form', type: 'form', styles: S(),
        props: {
          formId: '', title: 'Inscreva-se gratuitamente', subtitle: 'Vagas limitadas. Garanta a sua agora.',
          buttonText: 'Quero participar', buttonColor: '#4f46e5', bgColor: '#312e81', textColor: '#ffffff', layout: 'stacked',
        },
      },
    ],
  },
];
