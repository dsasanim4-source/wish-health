# 暖暖 - 你的健康记录小助手 🌸

专为肠胃敏感、容易焦虑的女生设计的温柔健康记录工具。

## 功能特性

- 🍽️ **饮食记录** - 记录每餐饮食和肠胃感受
- 💭 **情绪追踪** - 跟踪心情变化和焦虑程度
- 🌙 **睡眠监测** - 记录睡眠时间和质量
- 🌸 **生理期追踪** - 记录生理周期和症状
- 🏃 **运动记录** - 记录运动类型和强度
- 📊 **健康统计** - 可视化展示健康趋势
- 💛 **感恩日记** - 记录生活中的温暖小事

## 技术栈

- **前端框架**: Next.js 14
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **图表**: Recharts
- **数据存储**: 本地存储 (localStorage)

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打开浏览器访问 http://localhost:3000
```

## 部署到 Supabase

### 前置条件

1. 拥有 Supabase 账户
2. 拥有 GitHub 账户
3. 在 Supabase 中创建项目

### 部署步骤

1. **创建 Supabase 项目**
   - 登录 [Supabase](https://supabase.com/)
   - 点击 "New Project"
   - 填写项目名称为 `wish-health`
   - 选择你的组织
   - 设置数据库密码
   - 点击 "Create New Project"

2. **连接 GitHub 仓库**
   - 将代码推送到 GitHub 仓库
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/wish-health.git
   git push -u origin main
   ```

3. **在 Supabase 中部署**
   - 进入项目 Dashboard
   - 点击 "Deploy" 标签
   - 选择 "Host with Vercel" 或 "Host with Netlify"
   - 按照指引连接你的 GitHub 仓库
   - 配置构建设置：
     - Build Command: `npm run build`
     - Output Directory: `.next`
     - Install Command: `npm install`

### 替代部署方案

#### 部署到 Vercel（推荐）

1. 登录 [Vercel](https://vercel.com/)
2. 导入 GitHub 仓库
3. 框架预设选择 "Next.js"
4. 点击 "Deploy"

#### 部署到 Netlify

1. 登录 [Netlify](https://www.netlify.com/)
2. 导入 GitHub 仓库
3. 框架预设选择 "Next.js"
4. 点击 "Deploy"

## 项目结构

```
wish-health/
├── app/
│   ├── layout.tsx          # 根布局组件
│   ├── page.tsx            # 首页
│   ├── globals.css         # 全局样式
│   ├── record/
│   │   └── page.tsx        # 记录页面
│   ├── history/
│   │   └── page.tsx        # 历史记录页面
│   └── stats/
│       └── page.tsx        # 统计页面
├── components/
│   └── Navbar.tsx          # 导航组件
├── lib/
│   ├── types.ts            # 类型定义
│   └── storage.ts          # 本地存储逻辑
├── public/                 # 静态资源
└── package.json
```

## 设计风格

- **配色**: 温柔治愈的莫兰迪色系
- **字体**: 圆润友好的字体
- **组件**: 圆角卡片设计
- **动画**: 柔和的过渡动画

## 健康小贴士

- 饮食注意：尽量少吃生冷辛辣的食物
- 情绪管理：试试深呼吸放松法
- 好好睡觉：保证7-8小时睡眠

## 许可证

MIT
