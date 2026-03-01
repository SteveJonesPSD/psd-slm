export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  pageContext: PageContext
}

export interface ChatResponse {
  message: ChatMessage
}

export interface PageContext {
  pathname: string
  module: string
  entityId?: string
}
