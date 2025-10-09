import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  // 连接池配置
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
  },
  // 查询日志
  logging: process.env.NODE_ENV === 'development',
}));





