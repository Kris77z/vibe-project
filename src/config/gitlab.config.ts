import { registerAs } from '@nestjs/config';

export default registerAs('gitlab', () => ({
  url: process.env.GITLAB_URL || 'https://gitlab.com',
  token: process.env.GITLAB_TOKEN,
  
  // API配置
  api: {
    version: 'v4',
    timeout: parseInt(process.env.GITLAB_API_TIMEOUT || '10000', 10),
    retries: parseInt(process.env.GITLAB_API_RETRIES || '3', 10),
  },
  
  // Webhook配置
  webhook: {
    secret: process.env.GITLAB_WEBHOOK_SECRET,
    endpoint: process.env.GITLAB_WEBHOOK_ENDPOINT || '/webhooks/gitlab',
  },
  
  // 同步配置
  sync: {
    enabled: process.env.GITLAB_SYNC_ENABLED === 'true',
    interval: parseInt(process.env.GITLAB_SYNC_INTERVAL || '300000', 10), // 5分钟
    batchSize: parseInt(process.env.GITLAB_SYNC_BATCH_SIZE || '10', 10),
  },
  
  // 映射配置
  mapping: {
    // GitLab项目状态到系统项目状态的映射
    projectStatus: {
      'active': 'ACTIVE',
      'archived': 'COMPLETED',
      'pending_delete': 'CANCELLED',
    },
    // GitLab Issue状态到系统任务状态的映射  
    issueStatus: {
      'opened': 'TODO',
      'closed': 'DONE',
    },
    // GitLab用户角色到系统角色的映射
    userRole: {
      'owner': 'ADMIN',
      'maintainer': 'ADMIN', 
      'developer': 'MEMBER',
      'reporter': 'VIEWER',
      'guest': 'VIEWER',
    },
  },
}));



