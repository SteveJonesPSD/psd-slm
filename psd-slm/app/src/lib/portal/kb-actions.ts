'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PortalContext } from './types'

export async function getPortalKbArticles(ctx: PortalContext) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('kb_articles')
    .select('id, title, slug, body, category_id, kb_categories(name), view_count, updated_at')
    .eq('org_id', ctx.orgId)
    .eq('status', 'published')
    .eq('is_public', true)
    .eq('is_internal', false)
    .order('title')

  return data || []
}

export async function getPortalKbArticle(slug: string, ctx: PortalContext) {
  const supabase = createAdminClient()

  const { data: article } = await supabase
    .from('kb_articles')
    .select('*, kb_categories(name)')
    .eq('org_id', ctx.orgId)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('is_public', true)
    .eq('is_internal', false)
    .single()

  if (!article) return null

  // Increment view count (fire-and-forget)
  supabase
    .from('kb_articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', article.id)
    .then(() => {})

  // Get ratings
  const { data: ratings } = await supabase
    .from('kb_article_ratings')
    .select('is_helpful')
    .eq('article_id', article.id)

  const totalRatings = ratings?.length || 0
  const helpfulCount = ratings?.filter((r: { is_helpful: boolean }) => r.is_helpful).length || 0

  // Check if this contact already rated
  const { data: myRating } = await supabase
    .from('kb_article_ratings')
    .select('id, is_helpful')
    .eq('article_id', article.id)
    .eq('contact_id', ctx.contactId)
    .maybeSingle()

  return { ...article, totalRatings, helpfulCount, myRating }
}

export async function ratePortalKbArticle(articleId: string, isHelpful: boolean, ctx: PortalContext) {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('kb_article_ratings')
    .select('id')
    .eq('article_id', articleId)
    .eq('contact_id', ctx.contactId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('kb_article_ratings')
      .update({ is_helpful: isHelpful })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('kb_article_ratings')
      .insert({
        article_id: articleId,
        contact_id: ctx.contactId,
        is_helpful: isHelpful,
        org_id: ctx.orgId,
      })
  }
}
