import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 创建5个主要字段分类（字段集）
 * 基于《人员信息字段0904.md》文档
 */
async function main() {
  console.log('🌱 开始创建字段分类...');

  // 1. 工作信息 (25字段)
  const workInfoSet = await prisma.fieldSet.upsert({
    where: { name: '工作信息' },
    update: { description: '工号、人员状态、部门、职务等工作相关信息' },
    create: { 
      name: '工作信息', 
      description: '工号、人员状态、部门、职务等工作相关信息',
      isSystem: true
    },
  });
  console.log('✅ 创建字段集：工作信息');

  // 2. 个人信息 (23字段)
  const personalInfoSet = await prisma.fieldSet.upsert({
    where: { name: '个人信息' },
    update: { description: '性别、出生日期、民族、籍贯、婚姻状况等个人基础信息' },
    create: { 
      name: '个人信息', 
      description: '性别、出生日期、民族、籍贯、婚姻状况等个人基础信息',
      isSystem: true
    },
  });
  console.log('✅ 创建字段集：个人信息');

  // 3. 证件信息 (4字段)
  const documentInfoSet = await prisma.fieldSet.upsert({
    where: { name: '证件信息' },
    update: { description: '身份标识、身份证/护照号码、证件有效期等' },
    create: { 
      name: '证件信息', 
      description: '身份标识、身份证/护照号码、证件有效期等',
      isSystem: true
    },
  });
  console.log('✅ 创建字段集：证件信息');

  // 4. 银行卡信息 (3字段)
  const bankInfoSet = await prisma.fieldSet.upsert({
    where: { name: '银行卡信息' },
    update: { description: '银行账号、开户行等银行卡信息' },
    create: { 
      name: '银行卡信息', 
      description: '银行账号、开户行等银行卡信息',
      isSystem: true
    },
  });
  console.log('✅ 创建字段集：银行卡信息');

  // 5. 合同信息 (7字段)
  const contractInfoSet = await prisma.fieldSet.upsert({
    where: { name: '合同信息' },
    update: { description: '合同类型、签订次数、合同起止日期等' },
    create: { 
      name: '合同信息', 
      description: '合同类型、签订次数、合同起止日期等',
      isSystem: true
    },
  });
  console.log('✅ 创建字段集：合同信息');

  console.log('🎉 字段分类创建完成！');
  console.log('\n📝 后续需要手动将字段分配到对应的字段集中。');
  console.log('   可以使用 assignFieldsToSet mutation 来分配字段。');
}

main()
  .catch((e) => {
    console.error('❌ 创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


