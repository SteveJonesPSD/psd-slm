import { requireAuth } from '@/lib/auth'
import { getAgentAvatars } from '@/lib/agent-avatars'
import { AvatarsForm } from './avatars-form'

export default async function AvatarsPage() {
  const user = await requireAuth()
  const avatars = await getAgentAvatars(user.orgId)

  return <AvatarsForm initialAvatars={avatars} />
}
