## GitLab Issue 同步方案与集成说明

本文档说明如何将 GitLab 的 Issue 流通过“逐步过渡”的方式同步到本系统（vibe-project 与 vibe-project-frontend），并最终支持直接在前端 `/issues` 中创建与双向同步。

### 目录

- 现状与组件
- 两条迁移路径概览（方案A / 方案B）
- 字段与状态映射建议
- 后端集成点（REST/GraphQL/GitLab Service）
- 前端集成点（/src/app/issues）
- 迁移步骤（建议顺序）
- 测试与回归清单
- 常见问题（FAQ）

---

### 现状与组件

- 旧服务 issue-management（Express）：
  - 接收 GitLab Webhook（Issues, Notes, Merge Requests），并在事件触发时执行：
    - 克隆关系查询与链接处理
    - 同步标签与状态
    - 异步写入 Apitable（工作线程）
  - 关键入口：`/gitlab/webhook`（Issue Hook / Note Hook），参见 `issue-management/src/router/gitlab.ts`

- 新后端 vibe-project（NestJS + GraphQL + Prisma）：
  - 已有 GitLab API 能力（创建/查询/更新 Issue、同步项目/任务）：`src/modules/gitlab`
  - 已有 Issue GraphQL 模块，用于系统内部 Issue 的 CRUD 与查询：`src/modules/issues`
  - 尚未提供 GitLab Webhook 接口（可新增）

- 新前端 vibe-project-frontend（Next.js App Router）：
  - `/issues` 列表与 `/issues/new` 创建页已接通后端 GraphQL

---

### 两条迁移路径概览

#### 方案A：沿用旧服务，事件中转到新后端（最快落地）

1. 继续在 GitLab 指向 `issue-management` 的 Webhook，不改变现有生产设置。
2. 在 `issue-management` 的 Issue/Note 处理分支内，追加调用新后端 GraphQL：
   - open → `createIssue`
   - update/label/state 变化 → `updateIssue` / `transitionIssueStatus`
   - note → `addIssueComment`
3. 字段映射（见下文）在中转逻辑中完成；项目/用户做映射（GitLab → 系统）

优点：改动小、见效快；复用旧有防抖/节流、Apitable 同步与成熟逻辑。

缺点：依赖旧服务中转，后续仍需迁移或退役旧服务。

#### 方案B：新后端提供 GitLab Webhook（长期更稳）

1. 在 `vibe-project` 新增 Webhook Controller（如：`/webhooks/gitlab`）。
2. GitLab Webhook 直接指向新后端，事件落库后按需同步到 Task 或回写 GitLab。
3. 可逐步替换掉 `issue-management` 中的“转发逻辑”，最终退役旧服务。

优点：架构更简单；一致性与扩展性更好；无需多跳。

缺点：初次切换需要在 GitLab 更新 Webhook 设置；需要一次性完善映射。

---

### 字段与状态映射建议

- 基础字段：
  - title ←→ GitLab.issue.title
  - description ←→ GitLab.issue.description
  - assigneeId ←→ GitLab.issue.assignee.id（需做用户映射：gitlabUserId → 系统 user.id）
  - projectId ←→ 系统项目 id（通过 GitLab 项目 id 映射 `Project.gitlabProjectId`）
  - dueDate ←→ GitLab.issue.due_date（可选）

- 业务字段：
  - priority：默认 `MEDIUM` 或基于 labels 映射
  - issueType：默认 `FEATURE` 或基于 labels 映射
  - inputSource：默认 `INTERNAL` 或基于 labels/路径映射

- 状态映射（建议）：
  - GitLab `opened` → 系统 `OPEN`
  - GitLab `closed` → 系统 `COMPLETED`
  - 更细粒度的流程（IN_DISCUSSION/IN_PRD/IN_DEVELOPMENT/IN_TESTING/IN_ACCEPTANCE）可通过 label 变化或 MR 事件扩展映射

---

### 后端集成点

- GitLab REST 封装（已存在）：`src/modules/gitlab/gitlab.service.ts`
  - `createIssue(projectId, data)`
  - `updateIssue(projectId, issueIid, data)`
  - `getProjectIssues(projectId, state)` / `getIssue(projectId, issueIid)`
  - `syncProject(gitlabProjectId, systemProjectId)`
  - `syncIssueToTask(gitlabProjectId, issueIid, systemTaskId)`

- GraphQL（Issue 模块，已存在）：
  - Mutation：`createIssue` / `updateIssue` / `transitionIssueStatus` / `addIssueComment`
  - Query：`issues` / `issue` / `issueStats`

- Webhook（待选实现——方案B）：
  - 新增 `GitlabWebhookController`，校验 `X-Gitlab-Token`，根据 `X-Gitlab-Event` 分发：
    - Issue Hook：open / update / close / reopen → 调用 IssuesService
    - Note Hook：对 `payload.issue` → `addIssueComment`
  - 配置：`GITLAB_WEBHOOK_SECRET`、`GITLAB_WEBHOOK_ENDPOINT`

---

### 前端集成点（/src/app/issues）

- 创建页：`/src/app/issues/new/page.tsx`
  - 已调用 `issueApi.createIssue`，可按需新增“同步到 GitLab”开关；后端在创建成功后根据项目绑定自动创建 GitLab Issue（推荐）或提供单独按钮调用 `POST /gitlab/projects/:projectId/issues`。

- 列表页：`/src/app/issues/page.tsx`
  - 已调用 `issueApi.getIssues`，可追加展示 GitLab 链接（建议在 Issue 模型中补充 `gitlabIssueId/gitlabIssueUrl` 字段，便于前端跳转）。

---

### 迁移步骤（建议顺序）

1) 方案A落地（当天可完成）
   - 在 `issue-management` 的 Issue/Note 分支中，追加调用新后端 GraphQL，实现 GitLab → 新系统 Issue/评论的镜像。
   - 完成项目/用户映射（GitLab → 系统），无法映射时兜底（不分配或默认负责人）。

2) 完善字段/状态映射
   - 基于 label/state 调整 priority/issueType/status 映射，补充 dueDate 等。

3) 切换为方案B（新后端直连 GitLab Webhook）
   - 新增 Webhook Controller 与配置，灰度项目逐步把 GitLab Webhook 指向新后端。
   - 验证无误后移除旧服务的“转发逻辑”。

4) 前端增强（可选）
   - 新建 Issue 成功后自动创建 GitLab Issue，并回写 `gitlabIssueId/gitlabIssueUrl`；或提供“同步到 GitLab”按钮。

---

### 测试与回归清单

- Webhook：
  - GitLab 新开 Issue → 新系统出现对应 Issue
  - 修改标题/描述/指派/标签 → 新系统同步
  - 关闭/重新打开 Issue → 新系统状态切换
  - 评论 Note → 新系统评论出现

- GraphQL/前端：
  - `/issues/new` 创建 → `/issues` 列表可见
  - （可选）创建后 GitLab 自动生成对应 Issue，链接可点击跳转

- 权限与映射：
  - GitLab 用户与系统用户映射正确，不存在时有兜底
  - 项目 `gitlabProjectId` 绑定正确

---

### 常见问题（FAQ）

- Q：GitLab 用户如何映射到系统用户？
  - A：优先使用 `gitlabUserId` 字段；若无，则按用户名/邮箱匹配；匹配失败则不分配或指派给默认负责人。

- Q：Issue 的优先级/类型如何从 GitLab 同步？
  - A：建议用 label 约定（如 `priority:high`、`type:feature`）→ 后端解析映射。

- Q：是否必须退役旧服务？
  - A：不必须。方案A可长期运行，但推荐在稳定后切至方案B减少系统耦合。


