export const OPPORTUNITY_STAGE_CONFIG = {
  prospecting: { label: 'Prospecting', color: '#6366f1', bg: '#eef2ff', defaultProbability: 10 },
  qualifying: { label: 'Qualifying', color: '#0891b2', bg: '#ecfeff', defaultProbability: 25 },
  proposal: { label: 'Proposal', color: '#d97706', bg: '#fffbeb', defaultProbability: 50 },
  negotiation: { label: 'Negotiation', color: '#ea580c', bg: '#fff7ed', defaultProbability: 75 },
  won: { label: 'Won', color: '#059669', bg: '#ecfdf5', defaultProbability: 100 },
  lost: { label: 'Lost', color: '#dc2626', bg: '#fef2f2', defaultProbability: 0 },
} as const

export type OpportunityStage = keyof typeof OPPORTUNITY_STAGE_CONFIG

export const ACTIVE_STAGES: OpportunityStage[] = ['prospecting', 'qualifying', 'proposal', 'negotiation']

export const LOST_REASONS = [
  'Price too high',
  'Chose competitor',
  'Budget cut / no budget',
  'Project cancelled',
  'No response / went dark',
  'Technical requirements not met',
  'Timing not right',
  'Other',
] as const
