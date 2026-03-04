import { requirePermission } from '@/lib/auth'
import { getChatArchive } from '@/lib/chat-sessions'
import { ChatArchiveList } from './chat-archive-list'

export default async function ChatArchivePage() {
  const user = await requirePermission('settings', 'view')
  const sessions = await getChatArchive()

  return <ChatArchiveList initialSessions={sessions} />
}
