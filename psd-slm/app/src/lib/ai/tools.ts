import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

type Tool = Anthropic.Messages.Tool

interface ToolDef {
  tool: Tool
  permission?: string // e.g. 'customers.view', or undefined for role-gated
  allowedRoles?: string[] // role-name whitelist (instead of permission)
}

const toolDefs: ToolDef[] = [
  {
    permission: 'customers.view',
    tool: {
      name: 'search_companies',
      description:
        'Search for companies/customers by name. Optionally filter by city or active status.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search term to match against company name' },
          city: { type: 'string', description: 'Filter by city (optional)' },
          is_active: { type: 'boolean', description: 'Filter by active status (optional)' },
        },
        required: ['query'],
      },
    },
  },
  {
    permission: 'customers.view',
    tool: {
      name: 'get_company_detail',
      description:
        'Get full details of a specific company including contact count, opportunity count, and quote count.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_id: { type: 'string', description: 'The UUID of the company' },
        },
        required: ['company_id'],
      },
    },
  },
  {
    permission: 'pipeline.view',
    tool: {
      name: 'get_pipeline_summary',
      description:
        'Get a summary of the sales pipeline aggregated by stage, showing count and total estimated value per stage.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  },
  {
    permission: 'pipeline.view',
    tool: {
      name: 'get_opportunities',
      description:
        'List opportunities with optional filters. Includes company name and assigned user.',
      input_schema: {
        type: 'object' as const,
        properties: {
          stage: {
            type: 'string',
            description: 'Filter by stage: prospecting, qualifying, proposal, negotiation, won, lost',
          },
          customer_id: { type: 'string', description: 'Filter by customer UUID' },
          assigned_to: { type: 'string', description: 'Filter by assigned user UUID' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: [],
      },
    },
  },
  {
    permission: 'quotes.view',
    tool: {
      name: 'get_quote_detail',
      description:
        'Get full quote details including lines, groups, and attributions. Buy prices are redacted for engineering role.',
      input_schema: {
        type: 'object' as const,
        properties: {
          quote_id: { type: 'string', description: 'The UUID of the quote' },
        },
        required: ['quote_id'],
      },
    },
  },
  {
    permission: 'quotes.view',
    tool: {
      name: 'get_quotes_for_company',
      description: 'List quote summaries for a specific company.',
      input_schema: {
        type: 'object' as const,
        properties: {
          customer_id: { type: 'string', description: 'The UUID of the customer' },
          status: { type: 'string', description: 'Filter by quote status (optional)' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['customer_id'],
      },
    },
  },
  {
    permission: 'deal_registrations.view',
    tool: {
      name: 'check_deal_registrations',
      description:
        'Check deal registrations, optionally for a specific customer or supplier. Includes lines with pricing and expiry info.',
      input_schema: {
        type: 'object' as const,
        properties: {
          customer_id: { type: 'string', description: 'Filter by customer UUID (optional)' },
          supplier_id: { type: 'string', description: 'Filter by supplier UUID (optional)' },
          status: {
            type: 'string',
            description: 'Filter by status: pending, active, expired, rejected (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    permission: 'products.view',
    tool: {
      name: 'search_products',
      description: 'Search products by name, SKU, or manufacturer.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search term to match against product name, SKU, or manufacturer',
          },
          category_id: { type: 'string', description: 'Filter by category UUID (optional)' },
          is_active: { type: 'boolean', description: 'Filter by active status (optional)' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
  },
  {
    allowedRoles: ['super_admin', 'admin', 'accounts'],
    tool: {
      name: 'get_margin_analysis',
      description:
        'Get margin traceability data showing buy/sell prices through the lifecycle. Only available to admin and accounts roles.',
      input_schema: {
        type: 'object' as const,
        properties: {
          customer_id: { type: 'string', description: 'Filter by customer UUID (optional)' },
          quote_number: { type: 'string', description: 'Filter by quote number (optional)' },
          limit: { type: 'number', description: 'Max results (default 50)' },
        },
        required: [],
      },
    },
  },
  {
    permission: 'team.view',
    tool: {
      name: 'get_team_summary',
      description:
        'Get team members with their opportunity and quote counts.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  },
]

export function getToolsForUser(
  permissions: string[],
  roleName: string
): Tool[] {
  return toolDefs
    .filter((td) => {
      if (td.allowedRoles) {
        return td.allowedRoles.includes(roleName)
      }
      if (td.permission) {
        return permissions.includes(td.permission)
      }
      return true
    })
    .map((td) => td.tool)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolInput = Record<string, any>

export async function executeTool(
  name: string,
  input: ToolInput,
  supabase: SupabaseClient,
  userRole: string
): Promise<string> {
  try {
    switch (name) {
      case 'search_companies':
        return await searchCompanies(input, supabase)
      case 'get_company_detail':
        return await getCompanyDetail(input, supabase)
      case 'get_pipeline_summary':
        return await getPipelineSummary(supabase)
      case 'get_opportunities':
        return await getOpportunities(input, supabase)
      case 'get_quote_detail':
        return await getQuoteDetail(input, supabase, userRole)
      case 'get_quotes_for_company':
        return await getQuotesForCompany(input, supabase)
      case 'check_deal_registrations':
        return await checkDealRegistrations(input, supabase)
      case 'search_products':
        return await searchProducts(input, supabase)
      case 'get_margin_analysis':
        return await getMarginAnalysis(input, supabase)
      case 'get_team_summary':
        return await getTeamSummary(supabase)
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return JSON.stringify({ error: message })
  }
}

// --- Tool Implementations ---

async function searchCompanies(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  let query = supabase
    .from('customers')
    .select('id, name, account_number, customer_type, city, postcode, is_active')
    .ilike('name', `%${input.query}%`)
    .order('name')
    .limit(20)

  if (input.city) {
    query = query.ilike('city', `%${input.city}%`)
  }
  if (input.is_active !== undefined) {
    query = query.eq('is_active', input.is_active)
  }

  const { data, error } = await query
  if (error) return JSON.stringify({ error: error.message })
  return JSON.stringify({ companies: data, count: data?.length ?? 0 })
}

async function getCompanyDetail(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  const { data: company, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', input.company_id)
    .single()

  if (error) return JSON.stringify({ error: error.message })

  const [contacts, opportunities, quotes] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('customer_id', input.company_id),
    supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('customer_id', input.company_id),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('customer_id', input.company_id),
  ])

  return JSON.stringify({
    company,
    contact_count: contacts.count ?? 0,
    opportunity_count: opportunities.count ?? 0,
    quote_count: quotes.count ?? 0,
  })
}

async function getPipelineSummary(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('stage, estimated_value')

  if (error) return JSON.stringify({ error: error.message })

  const stages: Record<string, { count: number; total_value: number }> = {}
  for (const opp of data || []) {
    if (!stages[opp.stage]) {
      stages[opp.stage] = { count: 0, total_value: 0 }
    }
    stages[opp.stage].count++
    stages[opp.stage].total_value += opp.estimated_value ?? 0
  }

  return JSON.stringify({ pipeline: stages })
}

async function getOpportunities(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  let query = supabase
    .from('opportunities')
    .select('id, title, stage, estimated_value, probability, expected_close_date, created_at, customers(name), users!opportunities_assigned_to_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 20)

  if (input.stage) query = query.eq('stage', input.stage)
  if (input.customer_id) query = query.eq('customer_id', input.customer_id)
  if (input.assigned_to) query = query.eq('assigned_to', input.assigned_to)

  const { data, error } = await query
  if (error) return JSON.stringify({ error: error.message })
  return JSON.stringify({ opportunities: data, count: data?.length ?? 0 })
}

async function getQuoteDetail(
  input: ToolInput,
  supabase: SupabaseClient,
  userRole: string
): Promise<string> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*, customers(name), users!quotes_assigned_to_fkey(first_name, last_name)')
    .eq('id', input.quote_id)
    .single()

  if (error) return JSON.stringify({ error: error.message })

  const [linesResult, groupsResult, attribResult] = await Promise.all([
    supabase
      .from('quote_lines')
      .select('*, products(name, sku)')
      .eq('quote_id', input.quote_id)
      .order('sort_order'),
    supabase
      .from('quote_groups')
      .select('*')
      .eq('quote_id', input.quote_id)
      .order('sort_order'),
    supabase
      .from('quote_attributions')
      .select('*, users(first_name, last_name)')
      .eq('quote_id', input.quote_id),
  ])

  // Redact buy prices for engineering role
  let lines = linesResult.data || []
  if (userRole === 'engineering') {
    lines = lines.map((line) => ({
      ...line,
      buy_price: '[redacted]',
    }))
  }

  return JSON.stringify({
    quote,
    lines,
    groups: groupsResult.data || [],
    attributions: attribResult.data || [],
  })
}

async function getQuotesForCompany(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  let query = supabase
    .from('quotes')
    .select('id, quote_number, status, version, quote_type, valid_until, created_at, users!quotes_assigned_to_fkey(first_name, last_name)')
    .eq('customer_id', input.customer_id)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 20)

  if (input.status) query = query.eq('status', input.status)

  const { data, error } = await query
  if (error) return JSON.stringify({ error: error.message })
  return JSON.stringify({ quotes: data, count: data?.length ?? 0 })
}

async function checkDealRegistrations(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  let query = supabase
    .from('deal_registrations')
    .select('*, customers(name), suppliers(name), deal_registration_lines(*, products(name, sku))')
    .order('created_at', { ascending: false })
    .limit(20)

  if (input.customer_id) query = query.eq('customer_id', input.customer_id)
  if (input.supplier_id) query = query.eq('supplier_id', input.supplier_id)
  if (input.status) query = query.eq('status', input.status)

  const { data, error } = await query
  if (error) return JSON.stringify({ error: error.message })
  return JSON.stringify({ deal_registrations: data, count: data?.length ?? 0 })
}

async function searchProducts(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  const searchTerm = `%${input.query}%`
  let query = supabase
    .from('products')
    .select('id, sku, name, manufacturer, default_buy_price, default_sell_price, is_stocked, is_active, product_categories(name)')
    .or(`name.ilike.${searchTerm},sku.ilike.${searchTerm},manufacturer.ilike.${searchTerm}`)
    .order('name')
    .limit(input.limit ?? 20)

  if (input.category_id) query = query.eq('category_id', input.category_id)
  if (input.is_active !== undefined) query = query.eq('is_active', input.is_active)

  const { data, error } = await query
  if (error) return JSON.stringify({ error: error.message })
  return JSON.stringify({ products: data, count: data?.length ?? 0 })
}

async function getMarginAnalysis(input: ToolInput, supabase: SupabaseClient): Promise<string> {
  let query = supabase
    .from('v_margin_traceability')
    .select('*')
    .limit(input.limit ?? 50)

  if (input.customer_id) query = query.eq('customer_id', input.customer_id)
  if (input.quote_number) query = query.eq('quote_number', input.quote_number)

  const { data, error } = await query
  if (error) return JSON.stringify({ error: error.message })
  return JSON.stringify({ margin_data: data, count: data?.length ?? 0 })
}

async function getTeamSummary(supabase: SupabaseClient): Promise<string> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, is_active, roles(display_name)')
    .eq('is_active', true)
    .order('first_name')

  if (error) return JSON.stringify({ error: error.message })

  const enriched = await Promise.all(
    (users || []).map(async (user) => {
      const [opps, quotes] = await Promise.all([
        supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id),
      ])
      return {
        ...user,
        opportunity_count: opps.count ?? 0,
        quote_count: quotes.count ?? 0,
      }
    })
  )

  return JSON.stringify({ team: enriched })
}
