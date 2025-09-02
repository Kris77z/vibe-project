import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  projectId: string;
  isDefault?: boolean;
}

export interface CreateWorkflowStateInput {
  workflowId: string;
  name: string;
  description?: string;
  color?: string;
  order: number;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface CreateWorkflowTransitionInput {
  workflowId: string;
  fromStateId: string;
  toStateId: string;
  name: string;
  description?: string;
}

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findByProject(projectId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { projectId },
      include: {
        states: {
          orderBy: { order: 'asc' },
        },
        transitions: {
          include: {
            fromState: true,
            toState: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return workflows;
  }

  async findOne(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        project: true,
        states: {
          orderBy: { order: 'asc' },
        },
        transitions: {
          include: {
            fromState: true,
            toState: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('工作流不存在');
    }

    return workflow;
  }

  async create(createWorkflowInput: CreateWorkflowInput, currentUserId: string) {
    const { projectId, ...workflowData } = createWorkflowInput;

    // 验证项目是否存在及权限
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 检查权限
    const hasAccess = project.ownerId === currentUserId || 
      project.members.some(member => member.userId === currentUserId);

    if (!hasAccess) {
      throw new ForbiddenException('无权限在此项目中创建工作流');
    }

    // 如果设置为默认工作流，先将其他工作流设为非默认
    if (workflowData.isDefault) {
      await this.prisma.workflow.updateMany({
        where: { projectId },
        data: { isDefault: false },
      });
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        ...workflowData,
        projectId,
      },
    });

    return this.findOne(workflow.id);
  }

  async createState(createStateInput: CreateWorkflowStateInput, currentUserId: string) {
    const { workflowId, ...stateData } = createStateInput;

    // 验证工作流是否存在及权限
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        project: {
          include: { members: true },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('工作流不存在');
    }

    // 检查权限
    const hasAccess = workflow.project.ownerId === currentUserId || 
      workflow.project.members.some(member => member.userId === currentUserId);

    if (!hasAccess) {
      throw new ForbiddenException('无权限修改此工作流');
    }

    // 如果设置为初始状态，先将其他状态设为非初始
    if (stateData.isInitial) {
      await this.prisma.workflowState.updateMany({
        where: { workflowId },
        data: { isInitial: false },
      });
    }

    const state = await this.prisma.workflowState.create({
      data: {
        ...stateData,
        workflowId,
      },
    });

    return state;
  }

  async createTransition(createTransitionInput: CreateWorkflowTransitionInput, currentUserId: string) {
    const { workflowId, fromStateId, toStateId, ...transitionData } = createTransitionInput;

    // 验证工作流是否存在及权限
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        project: {
          include: { members: true },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('工作流不存在');
    }

    // 检查权限
    const hasAccess = workflow.project.ownerId === currentUserId || 
      workflow.project.members.some(member => member.userId === currentUserId);

    if (!hasAccess) {
      throw new ForbiddenException('无权限修改此工作流');
    }

    // 验证状态是否存在且属于同一工作流
    const [fromState, toState] = await Promise.all([
      this.prisma.workflowState.findUnique({
        where: { id: fromStateId },
      }),
      this.prisma.workflowState.findUnique({
        where: { id: toStateId },
      }),
    ]);

    if (!fromState || fromState.workflowId !== workflowId) {
      throw new NotFoundException('起始状态不存在或不属于此工作流');
    }

    if (!toState || toState.workflowId !== workflowId) {
      throw new NotFoundException('目标状态不存在或不属于此工作流');
    }

    // 检查转换是否已存在
    const existingTransition = await this.prisma.workflowTransition.findUnique({
      where: {
        workflowId_fromStateId_toStateId: {
          workflowId,
          fromStateId,
          toStateId,
        },
      },
    });

    if (existingTransition) {
      throw new ForbiddenException('状态转换已存在');
    }

    const transition = await this.prisma.workflowTransition.create({
      data: {
        ...transitionData,
        workflowId,
        fromStateId,
        toStateId,
      },
      include: {
        fromState: true,
        toState: true,
      },
    });

    return transition;
  }

  async updateTaskState(taskId: string, newStateId: string, currentUserId: string) {
    // 获取任务信息
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { members: true },
        },
        workflowState: true,
      },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    // 检查权限
    const hasAccess = task.creatorId === currentUserId ||
      task.assigneeId === currentUserId ||
      task.project.ownerId === currentUserId ||
      task.project.members.some(member => member.userId === currentUserId);

    if (!hasAccess) {
      throw new ForbiddenException('无权限修改此任务状态');
    }

    // 验证新状态是否存在
    const newState = await this.prisma.workflowState.findUnique({
      where: { id: newStateId },
      include: { workflow: true },
    });

    if (!newState) {
      throw new NotFoundException('目标状态不存在');
    }

    // 如果任务已有工作流状态，验证状态转换是否允许
    if (task.workflowStateId) {
      const transition = await this.prisma.workflowTransition.findUnique({
        where: {
          workflowId_fromStateId_toStateId: {
            workflowId: newState.workflowId,
            fromStateId: task.workflowStateId,
            toStateId: newStateId,
          },
        },
      });

      if (!transition) {
        throw new ForbiddenException('不允许的状态转换');
      }
    }

    // 更新任务状态
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        workflowStateId: newStateId,
        // 如果是最终状态，同时更新任务状态为完成
        ...(newState.isFinal && { status: 'DONE' }),
      },
      include: {
        workflowState: true,
      },
    });

    return updatedTask;
  }

  async getAvailableTransitions(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        workflowState: {
          include: {
            workflow: true,
          },
        },
      },
    });

    if (!task || !task.workflowState) {
      return [];
    }

    const transitions = await this.prisma.workflowTransition.findMany({
      where: {
        workflowId: task.workflowState.workflowId,
        fromStateId: task.workflowStateId,
      },
      include: {
        toState: true,
      },
    });

    return transitions.map(transition => transition.toState);
  }

  async delete(id: string, currentUserId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        project: {
          include: { members: true },
        },
        _count: {
          select: {
            states: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('工作流不存在');
    }

    // 检查权限
    const hasAccess = workflow.project.ownerId === currentUserId;

    if (!hasAccess) {
      throw new ForbiddenException('无权限删除此工作流');
    }

    // 检查是否有状态在使用
    if (workflow._count.states > 0) {
      const tasksUsingStates = await this.prisma.task.count({
        where: {
          workflowState: {
            workflowId: id,
          },
        },
      });

      if (tasksUsingStates > 0) {
        throw new ForbiddenException('工作流正在被任务使用，不能删除');
      }
    }

    await this.prisma.workflow.delete({
      where: { id },
    });

    return { success: true, message: '工作流已删除' };
  }
}

