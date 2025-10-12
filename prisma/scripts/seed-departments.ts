import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 组织架构种子数据
 * 基于真实的组织结构图
 */
async function main() {
  console.log('🌱 开始导入组织架构数据...');

  // 1. 获取或创建公司
  const company = await prisma.company.upsert({
    where: { code: 'SZTU' },
    update: {},
    create: {
      name: '深圳用图科技有限公司',
      code: 'SZTU',
    },
  });
  console.log('✅ 公司已创建:', company.name);

  // 2. 创建一级部门（总经办、产品设计中心、技术研发中心等）
  const generalOffice = await prisma.department.upsert({
    where: { id: 'general-office' },
    update: { name: '总经办', companyId: company.id },
    create: {
      id: 'general-office',
      name: '总经办',
      companyId: company.id,
      parentId: null,
      leaderUserIds: [], // CEO 叶裴锋管理
    },
  });

  const productDesignCenter = await prisma.department.upsert({
    where: { id: 'product-design-center' },
    update: { name: '产品设计中心', companyId: company.id },
    create: {
      id: 'product-design-center',
      name: '产品设计中心',
      companyId: company.id,
      parentId: null,
      leaderUserIds: [], // CEO 叶裴锋管理
    },
  });

  const techRdCenter = await prisma.department.upsert({
    where: { id: 'tech-rd-center' },
    update: { name: '技术研发中心', companyId: company.id },
    create: {
      id: 'tech-rd-center',
      name: '技术研发中心',
      companyId: company.id,
      parentId: null,
      leaderUserIds: [], // 温明震管理
    },
  });

  const marketingCenter = await prisma.department.upsert({
    where: { id: 'marketing-center' },
    update: { name: '市场运营中心', companyId: company.id },
    create: {
      id: 'marketing-center',
      name: '市场运营中心',
      companyId: company.id,
      parentId: null,
      leaderUserIds: [], // 雷威管理
    },
  });

  console.log('✅ 一级部门已创建');

  // 3. 产品设计中心 → 产品设计事业部
  const productDesignDivision = await prisma.department.upsert({
    where: { id: 'product-design-division' },
    update: { name: '产品设计事业部', parentId: productDesignCenter.id, companyId: company.id },
    create: {
      id: 'product-design-division',
      name: '产品设计事业部',
      companyId: company.id,
      parentId: productDesignCenter.id,
      leaderUserIds: [], // 叶裴锋
    },
  });

  // 产品设计事业部下的三个部门
  await prisma.department.upsert({
    where: { id: 'product-dept' },
    update: { name: '产品部', parentId: productDesignDivision.id, companyId: company.id },
    create: {
      id: 'product-dept',
      name: '产品部',
      companyId: company.id,
      parentId: productDesignDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'design-dept' },
    update: { name: '设计部', parentId: productDesignDivision.id, companyId: company.id },
    create: {
      id: 'design-dept',
      name: '设计部',
      companyId: company.id,
      parentId: productDesignDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'test-dept' },
    update: { name: '测试部', parentId: productDesignDivision.id, companyId: company.id },
    create: {
      id: 'test-dept',
      name: '测试部',
      companyId: company.id,
      parentId: productDesignDivision.id,
    },
  });

  console.log('✅ 产品设计中心部门已创建');

  // 4. 技术研发中心 → 5个事业部
  // 前沿PC事业部
  const pcDivision = await prisma.department.upsert({
    where: { id: 'pc-division' },
    update: { name: '前沿PC事业部', parentId: techRdCenter.id, companyId: company.id },
    create: {
      id: 'pc-division',
      name: '前沿PC事业部',
      companyId: company.id,
      parentId: techRdCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'pc-business-dept' },
    update: { name: 'PC业务部', parentId: pcDivision.id, companyId: company.id },
    create: {
      id: 'pc-business-dept',
      name: 'PC业务部',
      companyId: company.id,
      parentId: pcDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'algorithm-dept' },
    update: { name: '算法策略部', parentId: pcDivision.id, companyId: company.id },
    create: {
      id: 'algorithm-dept',
      name: '算法策略部',
      companyId: company.id,
      parentId: pcDivision.id,
    },
  });

  // 机构版事业部
  const institutionalDivision = await prisma.department.upsert({
    where: { id: 'institutional-division' },
    update: { name: '机构版事业部', parentId: techRdCenter.id, companyId: company.id },
    create: {
      id: 'institutional-division',
      name: '机构版事业部',
      companyId: company.id,
      parentId: techRdCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'institutional-business-dept' },
    update: { name: '机构业务部', parentId: institutionalDivision.id, companyId: company.id },
    create: {
      id: 'institutional-business-dept',
      name: '机构业务部',
      companyId: company.id,
      parentId: institutionalDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'rd-innovation-dept' },
    update: { name: '研发创新部', parentId: institutionalDivision.id, companyId: company.id },
    create: {
      id: 'rd-innovation-dept',
      name: '研发创新部',
      companyId: company.id,
      parentId: institutionalDivision.id,
    },
  });

  // 前端K线事业部
  const frontendKlineDivision = await prisma.department.upsert({
    where: { id: 'frontend-kline-division' },
    update: { name: '前端K线事业部', parentId: techRdCenter.id, companyId: company.id },
    create: {
      id: 'frontend-kline-division',
      name: '前端K线事业部',
      companyId: company.id,
      parentId: techRdCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'frontend-rd-dept' },
    update: { name: '前端研发部', parentId: frontendKlineDivision.id, companyId: company.id },
    create: {
      id: 'frontend-rd-dept',
      name: '前端研发部',
      companyId: company.id,
      parentId: frontendKlineDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'backend-rd-dept' },
    update: { name: '后端研发部', parentId: frontendKlineDivision.id, companyId: company.id },
    create: {
      id: 'backend-rd-dept',
      name: '后端研发部',
      companyId: company.id,
      parentId: frontendKlineDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'im-dept' },
    update: { name: 'IM部', parentId: frontendKlineDivision.id, companyId: company.id },
    create: {
      id: 'im-dept',
      name: 'IM部',
      companyId: company.id,
      parentId: frontendKlineDivision.id,
    },
  });

  // AI技术事业部
  const aiTechDivision = await prisma.department.upsert({
    where: { id: 'ai-tech-division' },
    update: { name: 'AI技术事业部', parentId: techRdCenter.id, companyId: company.id },
    create: {
      id: 'ai-tech-division',
      name: 'AI技术事业部',
      companyId: company.id,
      parentId: techRdCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'ai-tech-dept' },
    update: { name: 'AI技术部', parentId: aiTechDivision.id, companyId: company.id },
    create: {
      id: 'ai-tech-dept',
      name: 'AI技术部',
      companyId: company.id,
      parentId: aiTechDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'content-ai-dept' },
    update: { name: '内容AI部', parentId: aiTechDivision.id, companyId: company.id },
    create: {
      id: 'content-ai-dept',
      name: '内容AI部',
      companyId: company.id,
      parentId: aiTechDivision.id,
    },
  });

  // 移动端事业部
  const mobileDivision = await prisma.department.upsert({
    where: { id: 'mobile-division' },
    update: { name: '移动端事业部', parentId: techRdCenter.id, companyId: company.id },
    create: {
      id: 'mobile-division',
      name: '移动端事业部',
      companyId: company.id,
      parentId: techRdCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'ios-dept' },
    update: { name: 'iOS', parentId: mobileDivision.id, companyId: company.id },
    create: {
      id: 'ios-dept',
      name: 'iOS',
      companyId: company.id,
      parentId: mobileDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'android-dept' },
    update: { name: 'Android', parentId: mobileDivision.id, companyId: company.id },
    create: {
      id: 'android-dept',
      name: 'Android',
      companyId: company.id,
      parentId: mobileDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'cross-platform-dept' },
    update: { name: '跨平台技术部', parentId: mobileDivision.id, companyId: company.id },
    create: {
      id: 'cross-platform-dept',
      name: '跨平台技术部',
      companyId: company.id,
      parentId: mobileDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'onchain-data-dept' },
    update: { name: '链上数据部', parentId: mobileDivision.id, companyId: company.id },
    create: {
      id: 'onchain-data-dept',
      name: '链上数据部',
      companyId: company.id,
      parentId: mobileDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'ops-dept' },
    update: { name: '运维部', parentId: mobileDivision.id, companyId: company.id },
    create: {
      id: 'ops-dept',
      name: '运维部',
      companyId: company.id,
      parentId: mobileDivision.id,
    },
  });

  // 后台事业部
  const backendDivision = await prisma.department.upsert({
    where: { id: 'backend-division' },
    update: { name: '后台事业部', parentId: techRdCenter.id, companyId: company.id },
    create: {
      id: 'backend-division',
      name: '后台事业部',
      companyId: company.id,
      parentId: techRdCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'app-dev-dept' },
    update: { name: '应用开发部', parentId: backendDivision.id, companyId: company.id },
    create: {
      id: 'app-dev-dept',
      name: '应用开发部',
      companyId: company.id,
      parentId: backendDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'platform-innovation-dept' },
    update: { name: '平台创新部', parentId: backendDivision.id, companyId: company.id },
    create: {
      id: 'platform-innovation-dept',
      name: '平台创新部',
      companyId: company.id,
      parentId: backendDivision.id,
    },
  });

  console.log('✅ 技术研发中心部门已创建');

  // 5. 市场运营中心
  const contentOperationDivision = await prisma.department.upsert({
    where: { id: 'content-operation-division' },
    update: { name: '内容运营事业部', parentId: marketingCenter.id, companyId: company.id },
    create: {
      id: 'content-operation-division',
      name: '内容运营事业部',
      companyId: company.id,
      parentId: marketingCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'content-operation-dept' },
    update: { name: '内容运营部', parentId: contentOperationDivision.id, companyId: company.id },
    create: {
      id: 'content-operation-dept',
      name: '内容运营部',
      companyId: company.id,
      parentId: contentOperationDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'content-innovation-dept' },
    update: { name: '内容创新部', parentId: contentOperationDivision.id, companyId: company.id },
    create: {
      id: 'content-innovation-dept',
      name: '内容创新部',
      companyId: company.id,
      parentId: contentOperationDivision.id,
    },
  });

  const userOperationDivision = await prisma.department.upsert({
    where: { id: 'user-operation-division' },
    update: { name: '用户运营事业部', parentId: marketingCenter.id, companyId: company.id },
    create: {
      id: 'user-operation-division',
      name: '用户运营事业部',
      companyId: company.id,
      parentId: marketingCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'user-operation-dept' },
    update: { name: '用户运营部', parentId: userOperationDivision.id, companyId: company.id },
    create: {
      id: 'user-operation-dept',
      name: '用户运营部',
      companyId: company.id,
      parentId: userOperationDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'product-operation-dept' },
    update: { name: '产品运营部', parentId: userOperationDivision.id, companyId: company.id },
    create: {
      id: 'product-operation-dept',
      name: '产品运营部',
      companyId: company.id,
      parentId: userOperationDivision.id,
    },
  });

  const commercialDivision = await prisma.department.upsert({
    where: { id: 'commercial-division' },
    update: { name: '商业化事业部', parentId: marketingCenter.id, companyId: company.id },
    create: {
      id: 'commercial-division',
      name: '商业化事业部',
      companyId: company.id,
      parentId: marketingCenter.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'business-dept' },
    update: { name: '商务部', parentId: commercialDivision.id, companyId: company.id },
    create: {
      id: 'business-dept',
      name: '商务部',
      companyId: company.id,
      parentId: commercialDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'bd-dept' },
    update: { name: 'BD部', parentId: commercialDivision.id, companyId: company.id },
    create: {
      id: 'bd-dept',
      name: 'BD部',
      companyId: company.id,
      parentId: commercialDivision.id,
    },
  });

  await prisma.department.upsert({
    where: { id: 'brand-dept' },
    update: { name: '品牌部', parentId: commercialDivision.id, companyId: company.id },
    create: {
      id: 'brand-dept',
      name: '品牌部',
      companyId: company.id,
      parentId: commercialDivision.id,
    },
  });

  console.log('✅ 市场运营中心部门已创建');

  console.log('🎉 组织架构导入完成！');
}

main()
  .catch((e) => {
    console.error('❌ 导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


