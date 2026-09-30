# dsh-whale-pet 🐳

> DeepSeek Harness 桌宠插件：一只会换装的**女仆装鲸鱼娘**，住在界面右下角。

内置 [Coopanion](https://github.com/Pal-AI-Lab/Coopanion) 项目的 whale 分层精灵
（25 层身体部件 + 表情图层 + 7 套配色方案），并**随 DeepSeek 模型的峰谷计价时段
自动更换头饰发带颜色**，同时在宠物下方**常驻显示时段倒计时圆环**。

## 功能

| 能力 | 说明 |
| --- | --- |
| 🐋 分层动画 | 25 层部件按 `model.json` 严格分层拼装，呼吸起伏、随机眨眼、头发/裙摆/鱼鳍/尾巴/呆毛持续摆动 |
| 🎭 表情状态机 | 待命（睁眼 + 中性表情）/ 工作中（加速游泳 + 手臂摆动 + 认真表情）/ 睡眠（收拢 + 闭眼 + 💤）/ 惊讶（时段切换瞬间 + 脸红） |
| 🕐 常驻倒计时 | 宠物下方圆环 + 文本：`距低谷 1h 23m`，按秒刷新；最后 60 秒变强调色脉冲；时段切换瞬间显示「已切换」 |
| 🔥 计价换装 | **高峰时段头饰发带变正红**；低谷 / 周末 / 节假日保持原色（蓝色系不受影响） |
| 💬 价格气泡 | 单击打开：模型、当前时段、三档官方单价（元/百万 tokens）、距下次切换倒计时、运行状态 |
| 🖱 交互 | 拖动移动（位置记忆）、单击开气泡、双击收拢成睡觉小鲸鱼（再双击展开） |
| 🛟 健壮性 | 部件图加载失败自动降级；渲染错误由错误边界隔离，不会拖垮整个界面 |

## 峰谷计价规则

数据来自 [DeepSeek 官方模型 & 价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
（2026-08-17 起生效）：

- **高峰时段**：北京时间周一至周五（不含中国法定节假日）**09:00–12:00** 与 **14:00–18:00**
- **空闲时段**：其余全部时间（含周末与中国法定节假日全天），价格为高峰的**一半**

当前支持模型：`deepseek-flash`、`deepseek-v4-pro`（`deepseek-chat` / `deepseek-reasoner`
等旧名自动映射）。

## 安装

这是一个 DSH profile bundle 插件包，作为本地包安装：

```bash
# 1. 克隆到任意目录
git clone https://github.com/drfai/dsh-whale-pet.git

# 2. 在 DSH 中安装并启用（本地路径安装）
#    - 图形界面：设置 → 插件 → 安装 → 选择该目录
#    - 或让 Agent 调用 plugin_manager：install_bundle <该目录的绝对路径>
```

安装后插件默认启用；若已打开页面未出现桌宠，刷新一次页面即可。

## 配置

编辑 `cordis.patch.yml` 中 `whale-pet` 行的 `config`：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `timeZone` | `Asia/Shanghai` | 计价时区 |
| `peakRanges` | `[[9,12],[14,18]]` | 高峰窗口 `[起, 止)`（小时，本地时间） |
| `holidays` | 2026 年中国法定假期 | 假期区间 `['开始','结束']`，全天按空闲计价；**每年需更新** |
| `pollMs` | `5000` | 浏览器轮询 `/whale-pet/state` 的间隔（毫秒） |

## 工作原理

```
Host 半侧 (lib/index.js, 零依赖 Cordis 插件)
  ├─ 峰谷计价引擎：按 ohai 时区 + 高峰窗口 + 法定假期 计算当前时段与窗口边界
  ├─ 活动追踪：监听 api-session/status，判断 Agent 是否在运行
  ├─ GET /whale-pet/state    当前时段 / 模型 / 单价 / 窗口 / 剩余毫秒（JSON，带 CORS）
  ├─ GET /whale-pet/assets/* Coopanion 分层素材（前缀路由，含路径穿越防护）
  └─ GET /whale-pet/image    可选备用形象图（默认不含，见下）

Client 半侧 (lib/client.js, React 18 手写 bundle)
  ├─ 注册到 shell.overlay 插槽（frame 级浮层，click-through，条目自行 opt-in）
  ├─ 分层渲染 <img> 部件 + feat 表情图层，CSS keyframes 近似原版弹簧动画
  ├─ 每 1 秒本地刷新倒计时圆环，每 5 秒轮询 Host 状态
  └─ 主题换装：SVG feColorMatrix 对头饰发带做确定性的白色→红色映射
```

Host 路由使用 `__DSH_TRANSPORT__.streamBaseUrl` 提供的 HTTP origin（桌面壳的页面在
`dsh-app://app` 自定义协议下，因此状态接口带 `Access-Control-Allow-Origin: *`）。

## 素材与版权

- **代码**：MIT，见 [LICENSE](LICENSE)
- **桌宠形象**：来自 [Pal-AI-Lab/Coopanion](https://github.com/Pal-AI-Lab/Coopanion)
  的 `packages/cortico-world-desktop-pet/web/whale/`（`model.json`、分层贴图、表情部件、
  7 套配色），**MIT License**，Copyright (c) 2026 Phantivia。
  详见 [assets/COOPANION-ATTRIBUTION.md](assets/COOPANION-ATTRIBUTION.md) 与
  [assets/coopanion/MANIFEST.md](assets/coopanion/MANIFEST.md)；上游
  `THIRD_PARTY_NOTICES.md` 亦随素材保留。
- 上游声明：whale 贴图由 ChatGPT（OpenAI 图像模型）生成后拆件，角色原设「溟月」，
  DeepSeek 女仆装二创参考 ZipZipPipe；围裙上的品牌标志图形归各公司所有，本项目与其无关联。
- 本仓库**不包含**任何 CC BY-NC-SA 素材。若你希望使用「女仆装鲸鱼娘」静态图作为降级方案，
  请自行放置 `assets/whale-maid.png`（该图来源为萌娘共享，CC BY-NC-SA 4.0，非商用）。

## 开发

- Host 半侧改完保存后，若 profile 的 HMR 监听目录包含本包源码目录，会热重载
- Client 半侧为手写 bundle（`window.__ModuleLoader__.load({ id, factory })`），
  改动后由 client-hmr 推送到已打开的页面；必要时刷新页面
- 计价引擎可独立测试：`node -e "import('./lib/index.js').then(m => console.log(m.phaseAt({timeZone:'Asia/Shanghai',peakRanges:[[9,12],[14,18]],holidays:[]}, Date.now())))"`

## 许可

MIT © contributors。第三方素材许可见上节。
