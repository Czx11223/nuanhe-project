# 暖禾家具 · 企业家居网站 PRD（产品需求文档）

> **文档状态**：需求已确认，待开发
> **版本**：v1.2
> **创建日期**：2026-08-24
> **更新日期**：2026-08-24
> **技术栈**：FastAPI + SQLite + React（前台 Tailwind CSS / 后台 Ant Design）
> **交付形态**：仅 PRD 文档，不含代码

---

## 文档信息

| 项目 | 内容 |
| --- | --- |
| 项目名称 | 暖禾家具企业家居网站 |
| 前台定位 | 企业品牌官网（展示型 + 留言咨询） |
| 后台定位 | 内容管理与运营后台（RBAC 多角色） |
| 目标用户（前台） | 终端消费者、求职者、经销商 |
| 目标用户（后台） | 超级管理员、内容编辑、运营人员 |
| 是否含电商 | 否（纯展示 + 留言/预约，无购物车/订单） |

---

## 1. 项目概述

### 1.1 背景
暖禾家具是一家集研发、制造、销售于一体的家居企业。为提升品牌形象、承接招聘与品牌展示，需建设一套**前台企业官网 + 后台管理系统**：前台用于品牌展示、产品与案例发布、新闻发布、招聘信息展示、客户留言预约；后台用于运营人员高效维护全部内容，并支持多角色分级权限。

参考站点：蓝鸟家具（https://www.lanniao.cn/）——本项目的栏目结构、信息架构参考其官网，品牌名、文案、产品分类等以 **暖禾家具** 重新命名，内容为示例/占位，可在后台配置。

### 1.2 目标
- 建立专业、统一的企业品牌形象展示窗口。
- 实现产品、案例、新闻、招聘等内容的**后台可视化维护**，降低运营门槛。
- 支持联系我们留言/预约，沉淀销售线索与招聘投递。
- 多角色权限隔离，保障后台安全。

### 1.3 范围

**包含（In Scope）**
- 前台 5 个主导航：首页、产品（产品中心 / 新案例展示）、新闻（企业新闻 / 行业资讯）、招聘入口（社会招聘 / 校园招聘）、关于我们（关于暖禾 / 发展历程 / 品牌介绍 / 联系我们）。
- 后台 11 个模块：登录鉴权、管理员与角色管理、轮播图、站点设置、关于我们内容、产品分类、产品、新闻、留言反馈、案例管理、招聘管理。
- 多角色 RBAC 权限、JWT 鉴权、Swagger 接口文档、移动端响应式。
- 工程组织：单一代码仓库下分 `api/`（后端服务接口，FastAPI）、`backend/`（后台管理系统，React + Ant Design）、`frontend/`（前台官网，React + Tailwind CSS）三个子目录，详见第 10 章。

**不包含（Out of Scope）**
- 在线商城 / 购物车 / 订单 / 支付。
- 会员系统 / 个人中心 / 第三方登录（微信、QQ 等）。
- 多语言（仅中文）。
- 生产环境部署与服务器采购（文档含部署建议，但不落地）。
- 招商加盟 / 投标项目（按需求决策已从前后台移除）。

### 1.4 术语
| 术语 | 说明 |
| --- | --- |
| RBAC |  ️基于角色的访问控制（Role-Based Access Control） |
| JWT | JSON Web Token，用于接口鉴权 |
| 轮播图 | 首页顶部 Banner 广告位 |
| 案例展示 | 产品/工程落地案例的图文展示 |
| 招聘入口 | 前台发布社会招聘与校园招聘信息的栏目 |

---

## 2. 用户角色与权限模型

### 2.1 角色定义
| 角色 | 代码 | 职责 |
| --- | --- | --- |
| 超级管理员 | `super_admin` | 全部权限；管理系统员与角色；系统级配置 |
| 内容编辑 | `editor` | 维护轮播图、关于我们、产品、新闻、案例、招聘等内容 |
| 运营 | `operator` | 处理留言反馈、维护站点设置（联系方式/SEO）、内容只读 |

### 2.2 权限矩阵
| 模块 | 超级管理员 | 内容编辑 | 运营 |
| --- | --- | --- | --- |
| 登录与鉴权 | ✅ | ✅ | ✅ |
| 管理员与角色管理 | ✅ | ❌ | ❌ |
| 轮播图管理 | ✅ | ✅ | ❌ |
| 站点设置 | ✅ | ❌ | ✅（编辑） |
| 关于我们内容管理 | ✅ | ✅ | ❌ |
| 产品分类管理 | ✅ | ✅ | ❌ |
| 产品管理 | ✅ | ✅ | ❌ |
| 新闻管理 | ✅ | ✅ | ❌ |
| 案例管理 | ✅ | ✅ | ❌ |
| 招聘管理 | ✅ | ✅ | ❌ |
| 留言反馈管理 | ✅ | ❌ | ✅ |

> 说明：权限以「模块 + 操作（查看/新增/编辑/ 删除）」粒度存储在角色记录中（JSON 数组），后台按角色动态渲染菜单与按钮。

---

## 3. 前台官网系统功能需求

### 3.1 首页
**页面目标**：建立第一印象，引导至各栏目。
**板块构成**：
1. 顶部品牌导航栏（Logo + 5 主导航：首页 / 产品 / 新闻 / 招聘入口 / 关于我们 + 搜索占位）。
2. 轮播图区：读取后台「轮播图」，自动轮播，点击跳转链接。
3. 品牌概览：一句话品牌定位 + 数据（建厂年份、产线数、荣誉数等，来自站点设置/关于暖禾）。
4. 工艺亮点（4 大核心优势）：图标卡片（人体工程学 / 原创设计 / 智能产线 / 贴心售后），内容可由「品牌介绍」派生或独立配置。
5. 产品预览：推荐产品（后台标记 `is_recommended`）横向滚动。
6. 新闻预览：最新 3-5 条新闻（企业新闻 / 行业资讯）。
7. 招聘 / 关于我们入口：大图卡片，引导至对应栏目。
8. 页脚：公司信息（地址/电话/邮箱/备案号）、友情链接、版权。

### 3.2 产品中心
**结构**：分类导航（左侧/顶部）→ 产品列表（网格）→ 产品详情。
- **分类导航**：展示「产品分类」（如示例：胡桃禮、如意春、禧YUE、柏悦、蓝宝嘉、办公家具、软体，可在后台配置），支持「全部」。
- **产品列表**：封面图、名称、系列、参考价（可选展示）、「查看详情」。支持分类筛选。
- **产品详情**：大图轮播、名称、系列、参考价、规格参数、详细描述、相关推荐。
**交互**：列表懒加载/分页；详情页返回列表保留筛选态。

### 3.3 新案例展示（NEW）
- **列表**：按发布时间倒序，封面图 + 标题 + 摘要 + 分类（可选：项目案例/客户案例）；支持分类筛选。
- **详情**：标题、分类、封面、正文（富文本）、相关产品推荐。
- **数据来源**：后台「案例管理」。
**说明**：本栏目为需求 v1.2 恢复的案例展示功能，此前确认删除后本次重新引入。

### 3.4 新闻（企业新闻 / 行业资讯）
- 导航「新闻」下分「企业新闻」「行业资讯」两个二级入口，对应新闻的 `category` 字段（取值：企业新闻 / 行业资讯）。
- **新闻列表**：按发布时间倒序，封面图 + 标题 + 摘要 + 日期 + 分类标签；可按二级入口筛选。
- **新闻详情**：标题、分类、发布日期、作者、正文（富文本）、阅读量。
**交互**：列表分页；详情正文排版适配移动端。

### 3.5 招聘入口（社会招聘 / 校园招聘）
- 导航「招聘入口」下分「社会招聘」「校园招聘」两个二级入口，对应招聘的 `type` 字段（取值：社会招聘 / 校园招聘）。
- **职位列表**：按类型筛选，展示职位名、部门、工作地点、发布时间；点击查看职位详情（职责、要求）。
- **简历投递**：支持在线投递（姓名、电话、邮箱、简历附件、留言），提交进入后台「留言反馈」或独立投递记录（本项目暂归入留言反馈，类型标记为「简历投递」）。
**数据来源**：后台「招聘管理」。

### 3.6 关于我们（关于暖禾 / 发展历程 / 品牌介绍 / 联系我们）
前台「关于我们」为二级导航，包含 4 个子页面：
- **关于暖禾**：公司介绍图文（来自后台「关于我们内容」`section=about_暖禾`）。
- **发展历程**：品牌发展时间轴（来自后台「关于我们内容」`section=history`）。
- **品牌介绍**：品牌理念与工艺亮点（来自后台「关于我们内容」`section=brand`）。
- **联系我们**：公司信息（地址/电话/邮箱/营业时间，来自后台「站点设置」，可配置）+ 地图嵌入（经纬度来自站点设置）+ 留言/预约表单（写入后台「留言反馈」）。

---

## 4. 后台管理系统功能需求

### 4.1 登录与鉴权
- 登录页：账号 + 密码，错误锁定提示；登录成功后返回 JWT（Access Token）。
- Token 机制：Bearer Token 放入请求头 `Authorization`；后端中间件校验；过期返回 401。
- 退出登录：前端清除 Token。
-  ️密码：bcrypt 哈希存储，禁止明文。

### 4.2 管理员与角色管理
- **管理员列表**：用户名、姓名、角色、状态、最后登录时间；新增/编辑/禁用。
- **角色管理**：角色名、代码、权限（勾选模块 + 操作粒度）；新增/编辑/删除（超级管理员角色不可删除）。
- 约束：至少保留 1 个超级管理员；禁用账号无法登录。

### 4.3 轮播图管理
- 字段：标题、图片、跳转链接、排序、状态（启用/停用）。
- 功能：上传图片（本地存储，返回 URL）、增删改查、拖拽排序、启停。
- 前台首页读取 `status=启用` 并按 `sort` 升序展示。

### 4.4  ️站点设置
- 单条记录（系统级配置）：站点名称、Logo、备案号（ICP）、公司地址、电话、邮箱、营业时间、地图经纬度、SEO 标题/关键词/描述。
- 功能：编辑保存；运营角色可编辑，内容编辑只读。

### 4.5 关于我们内容管理
- 按 `section` 管理多条内容：`about_暖禾`（关于暖禾）、`history`（发展历程）、`brand`（品牌介绍）。
- 字段：`section`、`title`、`content`（富文本）、`image_url`、`sort`、`status`。
- 发展历程以时间轴形式在前台展示；品牌介绍可关联首页「工艺亮点」。

### 4.6 产品分类管理
- 字段：`name`、`parent_id`（支持二级，留空为一级）、`sort`、`status`。
- 功能：树形展示、新增/编辑/删除（删除前校验无关联产品）。

### 4.7 产品管理
- 字段：`category_id`、`name`、`series`（系列名）、`code`（货号）、`reference_price`（可选）、`cover_image`、`gallery`（多图 JSON）、`description`（富文本）、`specs`（规格文本/JSON）、`is_recommended`（是否首页推荐）、`sort`、`status`、`created_at`、`updated_at`。
- 功能：列表（按分类筛选）、新增/编辑（含富文本编辑器 + 多图上传）、删除、上/下架、设为推荐。
- 详情页预览链接（前台产品详情）。

### 4.8 新闻管理
- 字段：`title`、`category`（取值：企业新闻 / 行业资讯）、`cover_image`、`summary`、`content`（富文本）、`author`、`publish_status`（草稿/已发布）、`published_at`、`views`、`sort`、`created_at`、`updated_at`。
- 功能：列表、草稿/发布切换、新增/编辑/删除、置顶。

### 4.9 留言反馈管理
- 数据来源：前台「联系我们」表单、招聘「简历投递」。
- 字段：`name`、`phone`、`email`、`type`（留言/预约/咨询/简历投递）、`content`、`status`（待处理/已处理/已忽略）、`reply`、`created_at`、`handled_at`。
- 功能：列表（按状态/类型筛选）、查看详情、标记处理/忽略、回复（记录回复内容）。

### 4.10 案例管理（NEW）
- 字段：`title`、`category`（可选：项目案例/客户案例）、`cover_image`、`summary`、`content`（富文本）、`sort`、`status`、`created_at`、`updated_at`。
- 功能：列表（按分类筛选）、新增/编辑（含封面图上传）、删除、置顶。
- 前台「新案例展示」读取 `status=启用` 并按 `sort` 升序展示。

### 4.11 招聘管理（NEW）
- 字段：`type`（社会招聘 / 校园招聘）、`title`（职位名）、`department`、`location`、`description`（富文本：岗位职责）、`requirements`（任职要求）、`status`（招聘中/停用）、`sort`、`created_at`、`updated_at`。
- 功能：列表（按类型筛选）、新增/编辑/删除、启停。
- 前台「招聘入口」按 `type` 展示对应职位。

---

## 5. 信息架构与导航设计

### 5.1 前台信息架构
```
暖禾家具
├─ 首页
├─ 产品
│   ├─ 产品中心（分类 + 列表 + 详情）
│   └─ 新案例展示（列表 + 详情）
├─ 新闻
│   ├─ 企业新闻（列表 + 详情）
│   └─ 行业资讯（列表 + 详情）
├─ 招聘入口
│   ├─ 社会招聘（列表 + 详情）
│   └─ 校园招聘（列表 + 详情）
└─ 关于我们
    ├─ 关于暖禾
    ├─ 发展历程
    ├─ 品牌介绍
    └─ 联系我们（信息 + 地图 + 留言）
```

### 5.2 后台信息架构
```
后台管理
├─ 工作台（概览，可选）
├─ 内容管理
│   ├─ 轮播图管理
│   ├─ 关于我们内容
│   ├─ 产品分类
│   ├─ 产品管理
│   ├─ 新闻管理
│   ├─ 案例管理
│   └─ 招聘管理
├─ 互动管理
│   └─ 留言反馈
├─ 系统设置
│   ├─ 站点设置
│   ├─ 管理员管理
│   └─ 角色管理
```

### 5.3 路由约定
- 前台：`/`、`/products`、`/products/:id`、`/cases`、`/cases/:id`、`/news?cat=企业新闻`、`/news?cat=行业资讯`、`/news/:id`、`/recruitment?type=社会招聘`、`/recruitment?type=校园招聘`、`/about/暖禾`、`/about/history`、`/about/brand`、`/about/contact`
- 后台：`/login`、`/dashboard`、`/banners`、`/about-content`、`/product-categories`、`/products`、`/news`、`/cases`、`/recruitments`、`/messages`、`/site-settings`、`/admins`、`/roles`

---

## 6. 数据库设计

### 6.1 ER 关系概览
```
admin_user ──(role_id)──> role
product ──(category_id)──> product_category
news (独立)
case (独立)
recruitment (独立)
banner (独立)
site_setting (单条)
about_content (按 section 多行)
message (独立)
```
> 除 `admin_user→role`、`product→product_category` 外，其余为相对独立的内容表，便于按需扩展。

### 6.2 核心数据表结构

**admin_user（管理员）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 自增 |
| username | string unique | 登录账号 |
| password_hash | string | bcrypt 哈希 |
| real_name | string | 姓名 |
| role_id | int FK | 关联 role |
| status | int | 1 启用 / 0 禁用 |
| created_at | datetime | |
| last_login_at | datetime | |

**role（角色）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| name | string | 角色名 |
| code | string unique | super_admin/editor/operator |
| permissions | JSON | 权限键数组 |
| description | string | |

**banner（轮播图）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| title | string | |
| image_url | string | |
| link_url | string | 跳转链接 |
| sort | int | 排序 |
| status | int | 1 启用 / 0 停用 |
| created_at / updated_at | datetime | |

**site_setting（站点设置，单条）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | 固定为 1 |
| site_name | string | |
| logo_url | string | |
| icp | string | 备案号 |
| address | string | |
| phone | string | |
| email | string | |
| business_hours | string | |
| latitude / longitude | float | 地图定位 |
| seo_title / seo_keywords / seo_description | string | SEO |

**about_content（关于我们）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| section | string | about_暖禾/history/brand |
| title | string | |
| content | text | 富文本 |
| image_url | string | |
| sort | int | |
| status | int | |

**product_category（产品分类）**
|  ️字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| name | string | |
| parent_id | int nullable | 一级为 null |
| sort | int | |
| status | int | |

**product（产品）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| category_id | int FK | |
| name | string | |
| series | string | 系列名 |
| code | string | 货号 |
| reference_price | decimal nullable | 参考价 |
| cover_image | string | |
| gallery | JSON | 多图 |
| description | text | 富文本 |
| specs | text | 规格 |
| is_recommended | int | 1 推荐 |
| sort | int | |
| status | int | 1 上架 / 0 下架 |
| created_at / updated_at | datetime | |

**news（新闻）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| title | string | |
| category | string | 企业新闻 / 行业资讯 |
| cover_image | string | |
| summary | string | |
| content | text | 富文本 |
| author | string | |
| publish_status | int | 1 已发布 / 0 草稿 |
| published_at | datetime | |
| views | int | |
| sort | int | |
| created_at / updated_at | datetime | |

**case（案例）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| title | string | |
| category | string nullable | 项目案例 / 客户案例 |
| cover_image | string | |
| summary | string | |
| content | text | 富文本 |
| sort | int | |
| status | int | 1 启用 / 0 停用 |
| created_at / updated_at | datetime | |

**recruitment（招聘）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| type | int | 1 社会招聘 / 2 校园招聘 |
| title | string | 职位名 |
| department | string | 部门 |
| location | string | 工作地点 |
| description | text | 岗位职责（富文本） |
| requirements | text | 任职要求 |
| status | int | 1 招聘中 / 0 停用 |
| sort | int | |
| created_at / updated_at | datetime | |

**message（留言反馈）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int PK | |
| name | string | |
| phone | string | |
| email | string nullable | |
| type | string | 留言/预约/咨询/简历投递 |
| content | text | |
| status | int | 0 待处理 / 1 已处理 / 2 已忽略 |
| reply | text nullable | |
| created_at | datetime | |
| handled_at | datetime nullable | |

---

## 7. 接口设计

### 7.1 鉴权方案
- 登录：`POST /api/auth/login` → 返回 `access_token`。
- 受保护接口：请求头 `Authorization: Bearer <token>`；后端依赖注入校验；失效返回 401。
- 公开接口（前台）：无需 Token，仅读。

### 7.2 前台公开 API（读）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/banners | 启用轮播图 |
| GET | /api/site-settings | 站点设置 |
| GET | /api/about-contents | 关于我们各板块 |
| GET | /api/product-categories | 产品分类树 |
| GET | /api/products?category_id=&keyword= | 产品列表 |
| GET | /api/products/{id} | 产品详情 |
| GET | /api/news?category=&page= | 新闻列表（category=企业新闻/行业资讯） |
| GET | /api/news/{id} | 新闻详情（阅读量+1） |
| GET | /api/cases?category=&page= | 案例列表 |
| GET | /api/cases/{id} | 案例详情 |
| GET | /api/recruitments?type=&page= | 招聘列表（type=社会招聘/校园招聘） |
| POST | /api/messages | 提交留言/预约/简历投递 |

### 7.3 后台管理 API（需 Token + 权限）
| 模块 | 主要路径 | 操作 |
| --- | --- | --- |
| 鉴权 | /api/auth/login |  ️登录 |
| 管理员 | /api/admins | 增删改查 |
| 角色 | /api/roles | 增删改查 |
| 轮播图 | /api/banners (管理) | 增删改查/启停 |
| 站点设置 | /api/site-settings (管理) | 编辑 |
| 关于我们 | /api/about-contents (管理) | 增删改查 |
| 产品分类 | /api/product-categories (管理) | 增删改查 |
| 产品 | /api/products (管理) | 增删改查/上下架/推荐 |
| 新闻 | /api/news (管理) | 增删改查/发布 |
| 案例 | /api/cases (管理) | 增删改查 |
| 招聘 | /api/recruitments (管理) | 增删改查/启停 |
| 留言 | /api/messages (管理) | 列表/处理 |

### 7.4 统一响应与错误码
- 成功：`{ "code": 0, "data": ..., "msg": "ok" }`
- 失败：`{ "code": <非零>, "msg": "错误描述" }`
- 常用码：`401` 未授权、`403` 无权限、`422` 参数校验失败、`404` 资源不存在、`500` 服务器错误。
- 文件上传：统一 `POST /api/upload` 返回 URL；限制类型（jpg/png/webp）与大小（≤5MB）。

---

## 8. 非功能性需求

### 8.1 性能
- 前台首屏加载 < 3s（CDN/压缩静态资源）。
- 列表接口响应 < 500ms（分页，单页 ≤20 条）。
- 图片懒加载、列表分页。

### 8.2 安全
- 密码 bcrypt 哈希；JWT 有效期建议 2h，刷新机制可选。
- 后台接口按角色鉴权，越权返回 403。
- 防 XSS：富文本存储做白名单过滤；输出转义。
- 表单防刷：留言/投递提交频率限制（如 60s 一次）。
- 上传文件类型与大小校验，防止恶意文件。

### 8.3 响应式与兼容性
- 前台适配桌面/平板/手机（Tailwind 断点）。
- 后台以桌面管理为主（Ant Design 响应式栅格），建议 ≥1280px 使用。

### 8.4 SEO
- 前台各页 `<title>`/`meta description`/关键词由站点设置 + 内容驱动。
- 语义化 HTML、图片 `alt`、合理 `h1-h3` 层级。

### 8.5 可维护性
- 单一仓库三目录：`api/`（FastAPI 服务，统一对外提供 REST 接口，含 Swagger 文档 `/docs`）、`backend/`（React + Ant Design 管理端，调用 api/）、`frontend/`（React + Tailwind 官网，调用 api/）；前后端通过 `api/` 解耦，可独立开发、构建与部署。
- 后端分层：路由 / 服务 / 模型 / Schema。
- 前端组件化；`backend/` 与 `frontend/` 为两个独立 React 应用，共享 `api/` 接口契约。
- 数据库迁移脚本管理（如 Alembic 或简单 init SQL）。

---

## 9. 项目里程碑与交付物

### 9.1 里程碑（建议）
| 阶段 | 内容 | 周期（参考） |
| --- | --- | --- |
| M1 | 需求确认（本文档）+ 数据库设计 + 项目脚手架 | 1 周 |
| M2 | `api/` 后端服务：鉴权/RBAC/基础 CRUD + Swagger | 2 周 |
| M3 | `backend/` 后台前端：11 个管理模块界面 | 2-3 周 |
| M4 | `frontend/` 前台官网：5 导航 + 各栏目页面 + 接口联调 | 2-3 周 |
| M5 | 联调测试、响应式/安全校验、交付 | 1 ,周 |

### 9.2 交付物清单
- 数据库初始化 SQL / 迁移脚本。
- 后端服务工程 `api/`（FastAPI + SQLite，含 Swagger 文档 `/docs`）。
- 前台官网工程 `frontend/`（React + Tailwind CSS）。
- 后台管理工程 `backend/`（React + Ant Design）。
- 接口文档（Swagger 自动生成，位于 `api/` 的 `/docs`）。
- 部署说明（README，含三目录启动方式）。

---

## 10. 工程目录结构与职责划分

本项目采用单一代码仓库（Monorepo），按职责划分为 `api/`、`backend/`、`frontend/` 三个子目录：

```
项目根目录/
├─ api/          # 后端服务接口（FastAPI + SQLite）
│   ├─ 提供全部 REST API（前台公开接口 + 后台管理接口）
│   ├─ JWT 鉴权、RBAC 权限校验、Swagger 文档（/docs）
│   └─ 数据库模型、Schema、服务层、路由层
├─ backend/      # 后台管理系统（React + Ant Design）
│   ├─ 调用 api/ 提供的管理接口
│   └─ 实现 11 个后台管理模块界面
└─ frontend/     # 前台企业官网（React + Tailwind CSS）
    ├─ 调用 api/ 提供的公开接口
    └─ 实现 5 个主导航栏目及二级页面
```

**职责说明**
| 目录 | 技术 | 职责 | 接口消费方 |
| --- | --- | --- | --- |
| `api/` | FastAPI + SQLite | 唯一后端服务，承载全部业务逻辑与数据持久化 | `backend/`、`frontend/` |
| `backend/` | React + Ant Design | 内容管理与运营后台界面 | 调用 `api/` |
| `frontend/` | React + Tailwind CSS | 品牌官网展示与用户交互界面 | 调用 `api/` |

**说明**：`api/` 为唯一后端服务；`backend/` 与 `frontend/` 均为独立前端应用，通过 HTTP 调用 `api/` 的接口，三者解耦、可独立部署。开发/构建/部署说明见各目录 README 与第 9.2 节交付物清单。

---

## 附录 A：示例产品分类（可在后台配置）
胡桃禮、如意春、禧YUE、柏悦、蓝宝嘉、办公家具、软体。

## 附录 B：默认管理员种子数据
- 账号 `admin` / 密码 `admin123`（首次登录强制修改），角色 `super_admin`。

## 附录 C：参考与备注
- 参考站点：蓝鸟家具 https://www.lanniao.cn/（仅结构参考，品牌与内容以 暖禾家具 重命名，均为示例/占位）。
- v1.2 变更：前台导航重构为 5 主导航（新增「新案例展示」「招聘入口」，移除「招商加盟」「投标项目」），后台对应新增「案例管理」「招聘管理」、移除「门店加盟管理」「投标项目管理」。
- 本 PRD 不包含代码实现，仅作为开发基线。
