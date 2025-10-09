import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = $1) as exists`,
    table,
  );
  return rows[0]?.exists === true;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2) as exists`,
    table,
    column,
  );
  return rows[0]?.exists === true;
}

async function run() {
  console.log('[ensure] 检查并创建核心表结构...');
  const mvTable = 'module_visibility';
  if (!(await tableExists(mvTable))) {
    console.log('[ensure] 创建表 module_visibility');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "module_visibility" (
        "id" text PRIMARY KEY,
        "moduleKey" text UNIQUE NOT NULL,
        "classification" "FieldClassification" NOT NULL,
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);
  } else {
    // 清理可能残留的列
    if (await columnExists(mvTable, 'allowManagerVisible')) {
      console.log('[ensure] 移除 module_visibility.allowManagerVisible');
      await prisma.$executeRawUnsafe(`ALTER TABLE "module_visibility" DROP COLUMN IF EXISTS "allowManagerVisible"`);
    }
  }

  // 移除 field_definitions.allowManagerVisible 列
  if (await columnExists('field_definitions', 'allowManagerVisible')) {
    console.log('[ensure] 移除 field_definitions.allowManagerVisible');
    await prisma.$executeRawUnsafe(`ALTER TABLE "field_definitions" DROP COLUMN IF EXISTS "allowManagerVisible"`);
  }

  console.log('[ensure] 完成');
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });





