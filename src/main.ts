import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 扩大请求体上限到10MB (支持base64头像上传)
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  
  // 获取配置服务
  const configService = app.get(ConfigService);
  
  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // 启用CORS（支持通过 CORS_ORIGIN 配置多个来源，逗号分隔）；
  // 若生产环境未配置，则暂时放行所有来源，避免预检(OPTIONS)被 405 拦截。
  const rawOrigins = process.env.CORS_ORIGIN;
  const allowlist = rawOrigins ? rawOrigins.split(',').map(s => s.trim()).filter(Boolean) : [];
  const corsOriginFn = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true); // 非浏览器或同域
    if (allowlist.length === 0) return callback(null, true); // 未配置时放行，避免 405
    callback(null, allowlist.includes(origin));
  };

  app.enableCors({
    origin: corsOriginFn as any,
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  
  // 设置全局前缀
  app.setGlobalPrefix('api');
  
  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  
  console.log(`🚀 应用启动成功！`);
  console.log(`📡 服务地址: http://localhost:${port}`);
  console.log(`📊 GraphQL Playground: http://localhost:${port}/graphql`);
  console.log(`🔗 API文档: http://localhost:${port}/api`);
}

bootstrap();

