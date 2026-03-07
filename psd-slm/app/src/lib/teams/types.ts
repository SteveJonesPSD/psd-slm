export interface TeamsNotificationSettings {
  enabled: boolean
  teamId: string | null
  channelId: string | null
  webhookUrl: string | null
  notifyJobAssigned: boolean
  notifyJobRescheduled: boolean
  notifyJobCancelled: boolean
}

export interface TeamsJobNotification {
  eventType: 'assigned' | 'rescheduled' | 'cancelled'
  jobRef: string
  jobId: string
  customerName: string
  siteAddress: string
  scheduledDate: string
  scheduledTime: string
  engineerName: string
  engineerUpn: string | null
  notes?: string
  engageUrl: string
}
