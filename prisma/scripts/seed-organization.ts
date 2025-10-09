import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DeptNode = {
  name: string;
  leaders?: string[]; // emails
  children?: DeptNode[];
};

const ORG_TREE: DeptNode[] = [
  { name: '总经办', leaders: ['yepeifeng@applychart.com'] },
  {
    name: '产品技术中心',
    leaders: ['simple@applychart.com'],
    children: [
      {
        name: '产品设计事业部',
        leaders: ['yepeifeng@applychart.com', 'yejieli@applychart.com'],
        children: [
          { name: '产品部' },
          { name: '设计部' },
          { name: '测试部' },
        ],
      },
      {
        name: '前沿PC事业部',
        leaders: ['simple@applychart.com'],
        children: [
          { name: 'PC业务部' },
          { name: '算法策略部' },
        ],
      },
      {
        name: '机构版事业部',
        leaders: ['blank@applychart.com'],
        children: [
          { name: '机构业务部' },
          { name: '研发创新部' },
        ],
      },
      {
        name: '前端K线事业部',
        leaders: ['duweizhi@applychart.com'],
        children: [
          { name: '前端研发部' },
          { name: '后端研发部' },
          { name: 'IM部' },
        ],
      },
      {
        name: 'AI技术事业部',
        leaders: ['fortran@applychart.com'],
        children: [
          { name: 'AI技术部' },
          { name: '内容AI部' },
        ],
      },
      {
        name: '移动端事业部',
        leaders: ['luzhaofeng@applychart.com'],
        children: [
          { name: 'iOS' },
          { name: 'Android' },
          { name: '跨平台技术部' },
          { name: '链上数据部' },
          { name: '运维部' },
        ],
      },
      {
        name: '后台事业部',
        leaders: ['jacky@applychart.com'],
        children: [
          { name: '应用开发部' },
          { name: '平台创新部' },
        ],
      },
    ],
  },
  {
    name: '发展运营中心',
    leaders: ['nicole@applychart.com'],
    children: [
      {
        name: '企业发展事业部',
        leaders: ['nicole@applychart.com'],
        children: [
          { name: 'HR&ADM部' },
          { name: '财务部' },
          { name: '法务部' },
        ],
      },
      {
        name: '市场运营事业部',
        leaders: ['nicole@applychart.com'],
        children: [
          { name: '内容运营部' },
          { name: '客户运营部' },
          { name: '海外拓展部' },
        ],
      },
    ],
  },
];

async function findLeaderIds(emails: string[] | undefined): Promise<string[]> {
  if (!emails || emails.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  return users.map((u) => u.id);
}

async function upsertDept(
  name: string,
  companyId: string,
  parentId?: string | null,
  leaderEmails?: string[],
) {
  const leaderIds = await findLeaderIds(leaderEmails);
  // 查重：同公司同父级下同名部门唯一
  const existed = await prisma.department.findFirst({
    where: { name, companyId: companyId || undefined, parentId: parentId || null },
    select: { id: true },
  });
  if (existed) {
    await prisma.department.update({
      where: { id: existed.id },
      data: { leaderUserIds: leaderIds },
    });
    return existed.id;
  }
  const created = await prisma.department.create({
    data: {
      name,
      companyId,
      parentId: parentId || null,
      leaderUserIds: leaderIds,
    },
    select: { id: true },
  });
  return created.id;
}

async function seed() {
  console.log('[seed-org] 开始组织结构导入...');
  const company = await prisma.company.upsert({
    where: { name: '深圳用图科技有限公司' },
    update: {},
    create: { name: '深圳用图科技有限公司', code: 'SZTU' },
  });

  async function walk(nodes: DeptNode[], parentId?: string | null) {
    for (const node of nodes) {
      const id = await upsertDept(node.name, company.id, parentId || null, node.leaders);
      if (node.children && node.children.length > 0) {
        await walk(node.children, id);
      }
    }
  }

  await walk(ORG_TREE);
  console.log('[seed-org] 完成');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





