# SIFI NFL 项目结构规划

## 目录结构

```
sifi_nfl/
├── public/                          # 静态资源
│   ├── images/                     # 图片资源
│   │   ├── logos/                  # 球队标志
│   │   ├── jerseys/                # 球队球衣
│   │   └── players/               # 球员头像
│   ├── fonts/                     # 字体文件
│   └── index.html                 # 入口HTML
│
├── src/
│   ├── common/                    # 通用代码（共享）
│   │   ├── types.ts              # TypeScript类型定义
│   │   ├── types.football.ts     # 橄榄球特定类型
│   │   ├── constants.ts          # 游戏常量
│   │   ├── constants.football.ts # 橄榄球特定常量
│   │   ├── utils.ts             # 工具函数
│   │   ├── random.ts            # 随机数生成
│   │   ├── names.ts            # 姓名生成
│   │   └── index.ts            # 通用导出
│   │
│   ├── worker/                    # 游戏逻辑（Worker线程）
│   │   ├── index.ts             # Worker入口
│   │   │
│   │   ├── core/               # 核心游戏系统
│   │   │   ├── game/          # 比赛系统
│   │   │   │   ├── index.ts
│   │   │   │   ├── play.ts     # 比赛模拟
│   │   │   │   ├── playByPlayLogger.ts
│   │   │   │   └── index.football.ts
│   │   │   │
│   │   │   ├── GameSim.football/  # 比赛引擎（参考zengm）
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts
│   │   │   │   ├── Play.ts
│   │   │   │   ├── PlayByPlayLogger.ts
│   │   │   │   ├── formations.ts
│   │   │   │   ├── penalties.ts
│   │   │   │   ├── getPlayers.ts
│   │   │   │   ├── getCompositeFactor.ts
│   │   │   │   ├── getBestPenaltyResult.ts
│   │   │   │   └── LngTracker.ts
│   │   │   │
│   │   │   ├── season/         # 赛季管理
│   │   │   │   ├── index.ts
│   │   │   │   ├── newSchedule.ts
│   │   │   │   ├── genPlayoffSeeds.ts
│   │   │   │   ├── genPlayoffSeries.ts
│   │   │   │   ├── getSchedule.ts
│   │   │   │   └── doAwards.football.ts
│   │   │   │
│   │   │   ├── draft/          # 选秀系统
│   │   │   │   ├── index.ts
│   │   │   │   ├── genPlayers.ts
│   │   │   │   ├── genOrder.ts
│   │   │   │   ├── runPicks.ts
│   │   │   │   ├── selectPlayer.ts
│   │   │   │   └── getRookieSalaries.ts
│   │   │   │
│   │   │   ├── finances/       # 财务系统
│   │   │   │   ├── index.ts
│   │   │   │   ├── assessPayrollMinLuxury.ts
│   │   │   │   └── getLuxuryTaxAmount.ts
│   │   │   │
│   │   │   ├── trade/          # 交易系统
│   │   │   │   ├── index.ts
│   │   │   │   ├── analyzeTrade.ts
│   │   │   │   └── proposeTrade.ts
│   │   │   │
│   │   │   ├── freeAgents/    # 自由球员系统
│   │   │   │   ├── index.ts
│   │   │   │   ├── autoSign.ts
│   │   │   │   └── decreaseDemands.ts
│   │   │   │
│   │   │   ├── contractNegotiation/ # 合同谈判
│   │   │   │   ├── index.ts
│   │   │   │   ├── accept.ts
│   │   │   │   └── create.ts
│   │   │   │
│   │   │   └── index.ts       # 核心系统导出
│   │   │
│   │   ├── db/                 # 数据库层
│   │   │   ├── index.ts
│   │   │   ├── Cache.ts       # 缓存系统
│   │   │   └── loadGame.ts    # 游戏加载
│   │   │
│   │   ├── views/              # 视图处理函数
│   │   │   ├── dashboard.ts
│   │   │   ├── roster.ts
│   │   │   ├── schedule.ts
│   │   │   ├── playoffs.ts
│   │   │   ├── trade.ts
│   │   │   ├── freeAgents.ts
│   │   │   ├── draft.ts
│   │   │   ├── history.ts
│   │   │   ├── standings.ts
│   │   │   ├── gameLog.ts
│   │   │   ├── playerStats.ts
│   │   │   ├── teamStats.ts
│   │   │   └── index.ts
│   │   │
│   │   └── api/               # API接口
│   │       ├── index.ts
│   │       ├── actions.ts
│   │       ├── processInputs.ts
│   │       └── toUI.ts
│   │
│   ├── ui/                        # 用户界面
│   │   ├── components/             # React组件
│   │   │   ├── common/         # 通用组件
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Dropdown.tsx
│   │   │   │   ├── JumpTo.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── player/        # 球员相关组件
│   │   │   │   ├── PlayerRow.tsx
│   │   │   │   ├── PlayerRatings.tsx
│   │   │   │   ├── PlayerSkills.tsx
│   │   │   │   └── PlayerInfoModal.tsx
│   │   │   │
│   │   │   ├── game/          # 比赛相关组件
│   │   │   │   ├── GameLive.tsx
│   │   │   │   ├── GameBoxScore.tsx
│   │   │   │   ├── PlayByPlay.tsx
│   │   │   │   └── GameSettings.tsx
│   │   │   │
│   │   │   ├── trade/         # 交易组件
│   │   │   │   ├── TradeModal.tsx
│   │   │   │   ├── TradeAssetPicker.tsx
│   │   │   │   └── TradeSummary.tsx
│   │   │   │
│   │   │   ├── draft/         # 选秀组件
│   │   │   │   ├── DraftRoom.tsx
│   │   │   │   ├── DraftPick.tsx
│   │   │   │   └── DraftBoard.tsx
│   │   │   │
│   │   │   ├── contract/      # 合同组件
│   │   │   │   ├── ContractOffer.tsx
│   │   │   │   ├── ContractDetails.tsx
│   │   │   │   └── ContractNegotiation.tsx
│   │   │   │
│   │   │   └── ...
│   │   │
│   │   ├── views/               # 主视图
│   │   │   ├── dashboard/    # 仪表盘
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   ├── roster/        # 球员名单
│   │   │   │   ├── index.tsx
│   │   │   │   └── DepthChart.tsx
│   │   │   │
│   │   │   ├── schedule/      # 赛程
│   │   │   │   ├── index.tsx
│   │   │   │   └── ScheduleList.tsx
│   │   │   │
│   │   │   ├── standings/    # 积分榜
│   │   │   │   ├── index.tsx
│   │   │   │   └── StandingsTable.tsx
│   │   │   │
│   │   │   ├── playoffs/      # 季后赛
│   │   │   │   ├── index.tsx
│   │   │   │   ├── PlayoffBracket.tsx
│   │   │   │   └── PlayoffSeries.tsx
│   │   │   │
│   │   │   ├── trade/         # 交易
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   ├── freeAgents/  # 自由球员
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   ├── draft/         # 选秀
│   │   │   │   ├── index.tsx
│   │   │   │   └── DraftRoom.tsx
│   │   │   │
│   │   │   ├── history/       # 历史
│   │   │   │   ├── index.tsx
│   │   │   │   └── HistoryViewer.tsx
│   │   │   │
│   │   │   ├── gameLog/      # 比赛日志
│   │   │   │   ├── index.tsx
│   │   │   │   └── GameLogList.tsx
│   │   │   │
│   │   │   ├── playerStats/   # 球员统计
│   │   │   │   ├── index.tsx
│   │   │   │   └── StatsTable.tsx
│   │   │   │
│   │   │   ├── teamStats/     # 球队统计
│   │   │   │   ├── index.tsx
│   │   │   │   └── StatsTable.tsx
│   │   │   │
│   │   │   ├── settings/      # 设置
│   │   │   │   ├── index.tsx
│   │   │   │   └── SettingsPanel.tsx
│   │   │   │
│   │   │   ├── newLeague/    # 创建新联盟
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   ├── loading/       # 加载游戏
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   └── more/          # 更多菜单
│   │   │       └── index.tsx
│   │   │
│   │   ├── hooks/               # React Hooks
│   │   │   ├── useGameAttributes.ts
│   │   │   ├── usePlayerRatings.ts
│   │   │   ├── useLocalAutosave.ts
│   │   │   ├── toWorker.ts
│   │   │   └── fromWorker.ts
│   │   │
│   │   ├── util/               # 工具函数
│   │   │   ├── helpers.ts
│   │   │   ├── formatStats.ts
│   │   │   ├── formatMoney.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── pages/              # 页面布局
│   │   │   └── index.tsx
│   │   │
│   │   └── index.tsx          # UI入口
│   │
│   └── test/                   # 测试文件
│       ├── setup.ts
│       ├── helpers.ts
│       └── *.test.ts
│
├── package.json               # 项目配置
├── tsconfig.json             # TypeScript配置
├── vitest.config.ts         # Vitest配置
├── .prettierrc              # Prettier配置
├── .eslintrc.json          # ESLint配置
└── README.md                # 项目说明
```

## 核心系统模块说明

### 1. 比赛引擎 (GameSim)
参考zengm的`GameSim.football`，实现完整的比赛模拟：
- 传球/跑动/射门/弃踢
- 四档决策
- 加时赛处理
- 伤病处理
- 比赛统计记录
- 逐回合播报

### 2. 赛季管理 (Season)
- 赛程生成（考虑不同联盟类型）
- 常规赛/季后赛管理
- 积分榜计算
- 奖项评选
- 年终总结

### 3. 选秀系统 (Draft)
- 球员生成（考虑年龄和潜力）
- 选秀顺序确定
- 选秀权交易
- 不同地区的选秀规则

### 4. 交易系统 (Trade)
- 球员+选秀权+现金交易
- 交易价值评估
- 薪资匹配验证
- AI交易决策

### 5. 自由球员系统 (FreeAgents)
- 自由球员市场
- 合同谈判
- 签约决策
- 期限裁掉

### 6. 合同系统 (Contract)
- 合同生成
- 薪资计算
- 奢侈税处理
- 最低工资验证

### 7. 财务系统 (Finances)
- 收入计算
- 支出计算
- 预算管理
- 财政等级

### 8. 球员发展 (Player Development)
- 年龄增长
- 属性提升/衰退
- 潜力系统
- 伤病影响

### 9. 球队AI (Team AI)
- 战术选择
- 球员轮换
- 交易决策
- 签约决策

## 数据模型

### Player（球员）
```typescript
{
  pid: number;              // 球员ID
  tid: number;              // 球队ID（undefined=自由球员）
  name: string;            // 姓名
  age: number;             // 年龄
  bornYear: number;        // 出生年份
  pos: string;            // 位置 (QB, RB, WR, ...)
  hgt: number;            // 身高 (0-100)
  stre: number;           // 力量 (0-100)
  spd: number;            // 速度 (0-100)
  endu: number;           // 耐力 (0-100)
  thv: number;            // 视野 (0-100)
  thp: number;            // 臂力 (0-100)
  tha: number;            // 精准度 (0-100)
  bsc: number;            // 爆发力 (0-100)
  elu: number;            // 灵巧度 (0-100)
  rtr: number;            // 跑动 (0-100)
  hnd: number;            // 接球 (0-100)
  pbk: number;            // 传球阻挡 (0-100)
  rbk: number;            // 跑动阻挡 (0-100)
  pcv: number;            // 抢球 (0-100)
  tck: number;            // 擒抱 (0-100)
  prs: number;            // 冲传 (0-100)
  rns: number;            // 跑防 (0-100)
  kpw: number;            // 踢球力量 (0-100)
  kac: number;            // 踢球精准 (0-100)
  ppw: number;            // 弃踢力量 (0-100)
  pac: number;            // 弃踢精准 (0-100)
  ovr: number;            // 综合评分 (0-100)
  pot: number;            // 潜力 (0-100)
  ratingsIndex: number;    // 当前评级索引
  statsIndex: number;      // 当前统计索引
  contract?: Contract;      // 合同
  injury?: Injury;         // 伤病
  skills: string[];       // 技能标签
}
```

### Team（球队）
```typescript
{
  tid: number;              // 球队ID
  region: string;          // 地区
  cid: number;            // 联赛ID
  did: number;            // 分区ID
  name: string;           // 球队名称
  abbrev: string;         // 简称
  colors: [string, string, string]; // 球队颜色
  pop: string;            // 市场规模
  srID: string;          // 随机数种子
  budget: number;         // 预算
  cash: number;           // 现金
  salaryPaid: number;     // 已付工资
  season: number;         // 当前赛季
  won: number;           // 胜场
  lost: number;          // 负场
  tied?: number;         // 平场
  otl?: number;          // 加时负场
  playoffsRoundsWon: number; // 季后赛轮次
  streak: number;         // 连胜/连负
  players: Player[];     // 球员列表
  depth: Record<string, Player[]>; // 深度表
  stats: TeamStats;      // 球队统计
}
```

### Game（比赛）
```typescript
{
  gid: number;               // 比赛ID
  season: number;           // 赛季
  day?: number;            // 比赛日
  playoffs?: boolean;       // 是否季后赛
  neutralSite?: boolean;    // 是否中立场地
  teams: [GameTeam, GameTeam]; // 双方球队
  overt: number;           // 加时次数
  scoringSummary?: any;    // 得分总结
  playByPlay: any;        // 逐回合记录
}
```

### Contract（合同）
```typescript
{
  amount: number;          // 年薪（千信用点）
  exp: number;            // 到期年份
  years: number;          // 剩余年数
  incentives: number;      // 激励金额
  signingBonus: number;   // 签约奖金
  guaranteed: number;     // 保障金额
  options: number[];      // 球队选项
  noTrade: boolean;       // 交易否决权
  playerRights?: any;      // 球员权利
}
```

## 开发阶段规划

### Phase 1: 基础框架（2-3周）
- [x] 项目结构设计
- [ ] package.json配置
- [ ] TypeScript配置
- [ ] 基础类型定义
- [ ] 数据库层搭建
- [ ] Worker/通信架构

### Phase 2: 比赛引擎（3-4周）
- [ ] GameSim基础类
- [ ] Play类（回合模拟）
- [ ] 比赛类型实现
- [ ] 阵型和球员上场
- [ ] 伤病系统
- [ ] 统计记录
- [ ] 逐回合播报

### Phase 3: 球员和球队（2-3周）
- [ ] 球员生成系统
- [ ] 球队生成系统
- [ ] 球员属性计算
- [ ] 综合评分计算
- [ ] 潜力系统
- [ ] 球员发展（年龄曲线）

### Phase 4: 赛季管理（2-3周）
- [ ] 赛程生成
- [ ] 常规赛模拟
- [ ] 积分榜
- [ ] 季后赛生成
- [ ] 季后赛模拟
- [ ] 奖项评选

### Phase 5: 交易和自由球员（2周）
- [ ] 交易界面
- [ ] 交易价值评估
- [ ] AI交易决策
- [ ] 自由球员市场
- [ ] 合同谈判

### Phase 6: 选秀系统（2周）
- [ ] 球员生成（选秀池）
- [ ] 选秀顺序
- [ ] 选秀流程
- [ ] 选秀权交易
- [ ] 跨地区选秀

### Phase 7: 财务系统（1-2周）
- [ ] 收入计算
- [ ] 支出计算
- [ ] 薪资帽系统
- [ ] 奢侈税计算
- [ ] 预算管理

### Phase 8: 用户界面（4-6周）
- [ ] 导航系统
- [ ] 仪表盘
- [ ] 球员名单
- [ ] 赛程界面
- [ ] 积分榜
- [ ] 比赛界面
- [ ] 交易界面
- [ ] 选秀界面
- [ ] 设置界面

### Phase 9: 测试和优化（2-3周）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] Bug修复
- [ ] 文档编写

### Phase 10: 打包和部署（1周）
- [ ] 生产构建
- [ ] 部署配置
- [ ] 用户测试
- [ ] 正式发布

## 技术要点

### 与zengm的主要区别
1. **多地区系统**: 不同地区有不同联赛结构
2. **跨地区转会**: 特殊的选秀和转会规则
3. **皇权杯**: 4年一次的跨地区锦标赛
4. **科幻元素**: 未来设定、科技背景
5. **文化差异**: 不同地区的文化特色

### 需要特别注意
1. **数据库设计**: 支持多地区联赛结构
2. **AI逻辑**: 不同地区的AI可能不同
3. **UI设计**: 体现科幻未来风格
4. **平衡性**: 确保游戏公平有趣
