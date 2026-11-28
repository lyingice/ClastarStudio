/* ============================================================
   使用教程：首次启动桌面版引导 + 5 步简易上手 + 全功能详细手册
   ============================================================ */
const PWTutorial = (() => {
  const LS_KEY = 'pixelWorkshop_tutorial_v1';

  const CHAPTERS = [
    {
      id: 'overview',
      title: '界面与工作区',
      subtitle: '认识三栏布局、工作区层级与多标签管理，1 分钟看懂像素工坊怎么组织内容。',
      cards: [
        {
          title: '三栏布局与标签页工作台',
          badge: '基础结构',
          action: { id: 'home', label: '回到首页' },
          summary: '像素工坊采用「左导航 + 中画布 + 右快捷」三栏架构；点击内容会以独立标签页打开，切换标签不会丢失未保存的编辑进度。',
          steps: [
            '<b>左侧导航栏</b>：分为「工作区」（你的各个模组/项目）、「工具」（色彩拓展 / 一键换色 / 变种工坊 / 素材库 / 模型库 / AI 助手）与「库」（最近打开 / 回收站）。',
            '<b>中间标签页</b>：顶部标签栏可同时开多张贴图、方块或工具页；标签名称带圆点提示代表有未保存修改；点 <code>+</code> 可新建内容。',
            '<b>右侧快捷栏</b>：把常用的「新建内容 / 导入 PNG / 导入 ZIP / 导出资源包 / DSH 资产索引」收在手边，并显示当前工作区统计与最近打开记录。',
            '<b>折叠与调整宽度</b>：拖动左右栏边缘分割条可调宽度，双击分割条重置；进入编辑器时右侧快捷栏会自动收起以腾出画布空间。'
          ],
          keys: [
            ['Ctrl + B', '收起 / 展开左侧栏'],
            ['Ctrl + Shift + B', '收起 / 展开右侧快捷栏']
          ]
        },
        {
          title: '工作区、大类别与文件夹管理',
          badge: '项目收纳',
          action: { id: 'new_ws', label: '＋ 新建工作区' },
          summary: '建议按「1 个模组 / 1 个材质包 = 1 个工作区」来组织，内部再分「大类别」和「文件夹」。',
          steps: [
            '点左侧「工作区」旁边的 <code>＋</code>（或首页中央的 <b>＋ 新建工作区</b>）输入项目名称并确认。',
            '在首页点 <b>＋ 新建大类别</b>（或右侧快捷操作），可建立如「矿石」「武器」「UI」等大类；点标题右侧可折叠收纳。',
            '需要多层细分时，在「＋ 新建内容」里选择 <b>文件夹</b>，即可在大类别下继续建子目录；左上角面包屑可一键返回上级。',
            '<b>右键工作区 / 卡片</b>：可重命名、复制、一键换色或移入回收站；首页右上支持按名称/类型排序、网格/列表切换与关键词搜索。'
          ],
          tip: '提示：如果打算联动 DSH 或导出 Minecraft 资源包，工作区名可以用中文方便自己看，命名空间可在「DSH 资产索引」或「导出资源包」时单独设成英文 Mod ID（如 <code>mymod</code>）。'
        }
      ]
    },
    {
      id: 'texture',
      title: '纹理与自定义画布',
      subtitle: '覆盖 16×16 传统贴图、最大 2048×2048 自定义画布、图层、参考图与可停靠面板。',
      cards: [
        {
          title: '新建传统纹理与自定义尺寸纹理',
          badge: '两种模式',
          action: { id: 'new_content', label: '＋ 新建内容' },
          summary: '新建纹理时可在「纹理」大项下选择 16×16 传统纹理，或支持任意非正方形尺寸的自定义纹理。',
          steps: [
            '确保已选中一个工作区，点击右侧 <b>＋ 新建内容</b>（或大类别末尾的虚线 <code>+</code> 卡）。',
            '选 <b>纹理 → 传统纹理</b>：直接建立标准的 <code>16×16</code> MC 贴图；选 <b>纹理 → 自定义纹理</b>：可自由设定宽高（最高支持 <code>2048×2048</code>，支持非正方形）。',
            '勾选底部「创建后立即打开」并点 <b>创建</b>，即可进入纹理工作室；画完后记得点顶栏绿色 <b>保存回仓库</b>。'
          ],
          tip: '注意：编辑器顶栏的「保存回仓库」才会把当前修改写回卡片；点「还原」会放弃未保存改动并重新载入上次保存的版本。',
          tipKind: 'warn'
        },
        {
          title: '绘画工具、镜像、画布裁剪与旋转',
          badge: '核心绘制',
          summary: '支持全套像素画笔、几何工具、镜像对称绘画以及画布无损调整。',
          steps: [
            '<b>左栏工具</b>：铅笔、橡皮、油漆桶、吸管、直线、矩形、椭圆（矩形/椭圆可切「空心 / 实心」）、移动与选区。',
            '<b>笔刷与对称</b>：可调笔刷粗细，勾选「左右镜像 / 上下镜像」可快速画对称装备或法阵；也可切换右键功能为「橡皮擦」或「背景色」。',
            '<b>画布尺寸与变换</b>：顶栏点击 <b>调整大小…</b> 可选择「裁剪」或「缩放」到目标宽高（支持 16×16 到 2048×2048 及常用预设）；顶栏按钮还支持水平/垂直翻转与顺/逆时针 90° 旋转。',
            '<b>网格与缩放</b>：滚轮缩放画布，按住中键或拖动画布空白/切换移动工具平移；顶栏 <b>网格</b> 旁的小箭头可配置像素网格显隐与间距。'
          ],
          keys: [
            ['B', '铅笔'],
            ['E', '橡皮'],
            ['G', '油漆桶'],
            ['I / Alt+点击', '吸管取色'],
            ['L / R / O', '直线 / 矩形 / 椭圆'],
            ['V / M', '移动 / 选择'],
            ['Ctrl + Z / Y', '撤销 / 重做']
          ]
        },
        {
          title: '多图层管理、参考图面板与自定义停靠布局',
          badge: '进阶工作流',
          summary: '自定义纹理和动画编辑器统一采用可停靠 Dock 布局，面板可合并标签、折叠、换栏或弹出独立小窗。',
          steps: [
            '<b>图层操作</b>：右侧「图层」面板支持新建、复制、上移/下移、向下合并、删除图层，调整不透明度与混合模式；勾选「按下层轮廓裁剪」可只在下层有像素的区域内上色。',
            '<b>参考与预览</b>：在右栏切到「参考与预览」标签，可导入本地参考图或点 <b>仓库素材</b> 从素材库直接挑图，并排对比或直接用吸管从参考图取色。',
            '<b>面板自由停靠</b>：拖住任意面板标题栏拖到另一面板上可合并成标签组，拖到边缘可重新排列；点标题栏右侧 <code>↗</code> 可弹出成独立悬浮小窗口并拖动缩放大小。',
            '<b>自定义顶栏按钮</b>：觉得顶栏太满时，点顶栏最左侧 <code>⋯</code> 按钮即可勾选要保留显示的功能按钮。'
          ]
        }
      ]
    },
    {
      id: 'animation',
      title: '动画编辑器与 .mcmeta',
      subtitle: '制作 MC 动态贴图（如火焰、传送门、发光矿石），支持插帧预览与 .png.mcmeta 导出。',
      cards: [
        {
          title: '创建、增删帧与洋葱皮参考',
          badge: '帧动画',
          action: { id: 'new_content', label: '新建动画' },
          summary: '动画本质上是纵向拼接的多帧像素图条，默认 16 帧（16×256），可在编辑器内随时增删或调整帧数。',
          steps: [
            '在「＋ 新建内容」里选 <b>动画</b> 即可创建默认 16 帧动画；也可以选 <b>导入 PNG</b>，如果图片高度是宽度的整数倍，会自动按「高 ÷ 宽」切分成多帧。',
            '在帧列表面板可点击新增帧、复制当前帧、删除帧或上下移动帧序；开启「洋葱皮」可半透明叠看上一帧/下一帧轮廓。',
            '每帧画布同样支持多图层、镜像绘画、自由调整宽高（最高 2048×2048）与 90° 旋转。'
          ],
          keys: [
            ['Space', '播放 / 暂停动画'],
            [', / .', '上一帧 / 下一帧']
          ]
        },
        {
          title: '.mcmeta 帧率、插帧预览与一键特效面板',
          badge: '动效与导出',
          summary: '可直接配置 Minecraft 的 frametime 与 interpolate（帧间平滑过渡），并利用内置扩展面板快速做发光/渐变。',
          steps: [
            '在「动画与导出」面板设置 <b>帧间隔（frametime，单位 tick）</b>，勾选 <b>插帧（interpolate）</b> 时预览窗会实时按线性混合演示相邻帧过渡。',
            '编辑器内置扩展「一键光源」与「彩色渐变叠加」（支持 2–8 个自定义色标并自动保存），可给整段动画批量叠光晕或流光渐变。',
            '点击顶栏 <b>导出</b> 可同时得到纵向长条 PNG 与对应的 <code>.png.mcmeta</code>；点 <b>保存回仓库</b> 后，导出资源包与 DSH 索引也会自动带上 <code>mcmeta</code> 数据。'
          ]
        }
      ]
    },
    {
      id: 'blocks_entities',
      title: 'MC 方块与实体盔甲',
      subtitle: '支持 6 面方块、交叉植物、复合连接纹理以及 64×32 双层人形盔甲与坐骑/生物装备。',
      cards: [
        {
          title: '方块模型（普通六面 / 顶底侧 / 复合连接纹理）',
          badge: '方块 3D',
          action: { id: 'new_content', label: '新建方块' },
          summary: '在方块编辑器中为各个面指定或现场绘制贴图，并在右侧实时拖拽旋转 3D 方块预览效果。',
          steps: [
            '新建内容选 <b>方块</b>，挑子类型：全六面同图、顶/底/侧面、六面独立、交叉植物，或 <b>复合纹理（支持 8×8 拼接、1×1×1 / 2×2×1 / 3×3×1 外轮廓连接预览）</b>。',
            '在左侧材质列表点某个面（如 <code>顶面 / 侧面</code>）旁的绘画按钮，会新开一个临时绘画标签页。',
            '画好后点该标签页顶栏绿色的 <b>应用回方块</b>，贴图会立即回传给方块 3D 视图；全部面满意后再在方块标签页点 <b>保存回仓库</b>。'
          ],
          tip: '复合纹理还支持直接导入一张整图并自动拆成 5 个连接面，非常适合做玻璃、连通边框或机械动力类连接方块。'
        },
        {
          title: '实体与装备纹理（盔甲 / 鞘翅 / 坐骑铠）',
          badge: '实体 3D',
          action: { id: 'new_content', label: '新建实体' },
          summary: '支持标准人形盔甲（64×32 双层：头盔/胸甲/靴子 + 护腿）、狼铠、马铠、鹦鹉螺铠、恶魂挽具与鞘翅。',
          steps: [
            '在「＋ 新建内容」展开 <b>实体</b>，选择「人形盔甲」或对应生物装备模板。',
            '点击材质层（如 <code>层 1</code> / <code>层 2</code>）进入专属绘画页（已带 UV 区域参照底图），画好后点绿色 <b>应用回盔甲</b>。',
            '回到实体标签页即可拖动查看双层盔甲穿戴后的 3D 立体效果，最后点 <b>保存回仓库</b>。'
          ]
        }
      ]
    },
    {
      id: 'color_variants',
      title: '色彩、换色与变种工坊',
      subtitle: '从科学配色的色彩拓展，到单卡一键换色，再到灰度映射批量生产矿石/木头系列变种。',
      cards: [
        {
          title: '色彩拓展：色阶推演与调色板管理',
          badge: '配色辅助',
          action: { id: 'color', label: '打开色彩拓展' },
          summary: '根据主色自动推导高光偏暖/阴影偏冷的像素色阶，提供材质球预览与自定义色卡保存。',
          steps: [
            '从左侧工具栏打开 <b>色彩拓展</b>（或在纹理编辑器顶栏直接点「色彩拓展」带入当前画笔色）。',
            '挑选基础色与色阶数量、色相偏移幅度，实时观察不同色阶在像素球/块上的明暗过渡。',
            '可将生成的色阶存为自定义调色板，随后在任意纹理或动画编辑器的色卡下拉框里直接选用。'
          ]
        },
        {
          title: '一键换色：单卡/单面快速改色',
          badge: '高效改色',
          action: { id: 'recolor', label: '打开一键换色' },
          summary: '保留原始纹理明暗肌理，对整张贴图、方块指定面或盔甲分层做整体色调替换。',
          steps: [
            '在首页右键任意作品选 <b>一键换色</b>，或从左侧工具 / 右侧快捷栏进入选择目标卡片（若为方块/盔甲，可选择针对全部面或单个面）。',
            '选择 7 种内置预设（主题单色 / 提亮 / 压暗 / 冷暖反转 / 灰阶 / 随机配色 / 反相），或套用材质色卡，再通过色相 / 饱和度 / 亮度微调。',
            '支持局部颜色聚类替换；满意后可「覆盖原卡」「另存为新卡」或直接导出 PNG。'
          ]
        },
        {
          title: '变种工坊：明度映射批量产出系列素材',
          badge: '批量变种',
          action: { id: 'variant', label: '打开变种工坊' },
          summary: '特别适合做同一套模板的多种材质变种（例如铁/金/钻石/下界合金/自定义矿石一键出全套）。',
          steps: [
            '打开左侧 <b>变种工坊</b>，从工作区挑选或拖入基准纹理（软件会提取它的明度分布）。',
            '勾选要生成的材质色阶（内置 6 套经典色阶，也支持增删和自定义每套色阶的色标）。',
            '预览生成的变种矩阵图，可一键将选中变种批量保存到当前工作区，或直接打包导出为 ZIP。'
          ]
        }
      ]
    },
    {
      id: 'assets',
      title: '素材库与原版 JAR',
      subtitle: '管理原版与模组参考纹理，理解 1200 张上限与桌面版完整 3070+ 原版包怎么放。',
      cards: [
        {
          title: '浏览、收藏与在编辑器里作为参考图',
          badge: '参考素材',
          action: { id: 'assets', label: '打开素材库' },
          summary: '素材库与你的项目工作区隔离，专门用来存放原版 Minecraft 或第三方模组纹理作为临摹/取色参考。',
          steps: [
            '打开左侧「工具 → <b>素材库</b>」，可按 <code>全部 / 原版 / 模组 / 本地 / 收藏</code> 分组并按分类过滤。',
            '点击任意纹理卡片可查看高清像素预览与尺寸，点「复制到工作区」可把它变成可编辑的正式作品，或点「收藏」置顶常用贴图。',
            '在纹理/动画编辑器中，点击顶栏 <b>仓库素材</b> 可直接导入贴图到画布，或在「参考与预览」面板点 <b>仓库素材</b> 作为对照参考图。'
          ]
        },
        {
          title: '导入原版 / 模组 .jar 的两种方式（突破 1200 张上限）',
          badge: '重要指南',
          summary: '在网页界面直接拖入 .jar 会触发 1200 张上限（防止 Base64 撑爆浏览器存储）；完整原版 3000+ 张贴图推荐用本地解包目录。',
          steps: [
            '<b>方式 A · 界面直接拖入（适合小型模组 / 少量资源包）</b>：在素材库直接拖入 <code>.jar</code> 或 <code>.zip</code>，自动按 <code>assets/&lt;namespace&gt;/textures</code> 归类（单次最多导入前 1200 张）。',
            '<b>方式 B · 本地完整解包（适合原版客户端 .jar / 大型模组）</b>：把原版客户端 <code>1.21.1.jar</code> 等放进仓库根目录的 <code>local/inbox/</code>，双击根目录的 <code>准备本地素材.bat</code>，脚本会在 <code>local/vanilla/</code> 生成完整的 3070+ 索引与 PNG（不占浏览器空间、无 1200 张上限）。',
            '<b>桌面版 .exe 读取本地包</b>：把生成好的 <code>local/vanilla</code> 文件夹复制到 <code>clastar-studio.exe</code> 同级的 <code>dist/local/vanilla/</code> 下（注意请用真实复制，不要用软链接/Junction，以免安全路径校验拦截），重启软件后素材库即会显示全部原版纹理。'
          ],
          tip: '注意：Create（机械动力）的 jar 放进 <code>local/inbox/</code> 后，<code>准备本地素材.bat</code> 也会同时生成 <code>local/create-pack.zip</code>，同样放到 <code>dist/local/create-pack.zip</code> 即可免选 jar 自动加载。',
          tipKind: 'warn'
        }
      ]
    },
    {
      id: 'models',
      title: '模型库与 Blockbench',
      subtitle: '管理 .bbmodel 模型集、Create 机械动力动静部件拆解、3D 预览与 Blockbench 双向同步。',
      cards: [
        {
          title: '导入 .bbmodel 与 Create 模组部件拆解',
          badge: '3D 模型',
          action: { id: 'models', label: '打开模型库' },
          summary: '模型库数据保存在 IndexedDB 中（不占 localStorage 空间），一个模型集可归纳「静态 / 动态 / 物品 / 覆盖」多个部件。',
          steps: [
            '从左侧「工具 → <b>模型库</b>」进入，可新建模型集、拖入 <code>.bbmodel</code> 文件，或点导入按钮选择 Create <code>.jar</code> / 资源包 <code>.zip</code>。',
            '拆解 Create 部件时可搜索并勾选想要的方块/机构，软件会自动分离静态结构、动态旋转部件及对应贴图。',
            '右侧支持鼠标拖拽旋转、滚轮缩放的 3D 模型预览（含 OBJ/MTL 与方块实体预览），也可把模型里的纹理单独分离提取到工作区重新绘制。'
          ]
        },
        {
          title: 'Blockbench 伴生插件双向联动',
          badge: '外部联动',
          summary: '通过仓库自带的 Blockbench 桥接脚本，可在像素工坊与 Blockbench 之间互传工程与贴图。',
          steps: [
            '在 Blockbench 中加载仓库提供的插件脚本 <code>integrations/blockbench/clastar-bridge.js</code>。',
            '在模型库选中某个模型部件点击「在 Blockbench 中打开 / 同步」，即可通过本地消息通道把 <code>.bbmodel</code> 与贴图推过去编辑，改完后再回传保存进模型库。'
          ]
        }
      ]
    },
    {
      id: 'io_backup',
      title: '导入导出与数据备份',
      subtitle: '快捷拖放导入、导出标准 Minecraft 资源包 ZIP，以及整库 JSON 备份迁移。',
      cards: [
        {
          title: '拖拽导入 PNG / ZIP 与资源包导出',
          badge: '资源包',
          action: { id: 'pack', label: '去多选导出' },
          summary: '把做好的多张贴图、动画、方块快速打包成可直接放进 Minecraft resourcepacks 的 ZIP。',
          steps: [
            '<b>拖入 PNG</b>：在窗口任意位置拖入图片，若当前在首页可建新卡，若在编辑器内可选「作为图层添加 / 设成参考图 / 新建标签」。',
            '<b>拖入资源包 ZIP</b>：把已有资源包 ZIP 拖入窗口，软件会自动新建对应工作区，并按目录结构自动分类。',
            '<b>导出资源包 ZIP</b>：在首页点击右上 <b>多选</b>，勾选要打包的卡片，再点右侧 <b>导出资源包</b>（或顶部已选栏的导出按钮），填写命名空间与描述后生成 ZIP（会自动附带 <code>pack.mcmeta</code> 与动画 <code>.png.mcmeta</code>）。'
          ]
        },
        {
          title: '整库 JSON 备份与回收站还原',
          badge: '数据安全',
          action: { id: 'settings', label: '打开设置/备份' },
          summary: '工作区、卡片与回收站保存在本地浏览器存储中，重要项目建议定期做一次 JSON 备份。',
          steps: [
            '点击右上角 <b>⚙ 设置</b>，点 <b>导出数据</b> 可将所有工作区和回收站导出为一份带日期的 <code>.json</code> 备份文件。',
            '换电脑、换端口或升级迁移时，点 <b>导入数据</b> 选回备份文件即可恢复。',
            '误删的卡片会先进入左侧「库 → <b>回收站</b>」，可在里面点「还原」找回或「彻底删除」。'
          ],
          tip: '桌面版 <code>clastar-studio.exe</code> 固定监听 <code>http://127.0.0.1:28766</code> 保证重启数据不丢；注意不要用旧的桌面浏览器快捷方式启动，二者存储路径不互通。'
        }
      ]
    },
    {
      id: 'ai_dsh',
      title: 'AI 助手与 DSH 联动',
      subtitle: '配置内置大模型助手直接作画/换色，并通过 DSH 资产索引把真实贴图与模型零幻觉交给 DSH。',
      cards: [
        {
          title: '内置 AI 助手（接入你的 API Key 或本地模型）',
          badge: 'AI 协作',
          action: { id: 'agent', label: '打开 AI 助手' },
          summary: '支持 OpenAI 兼容、DeepSeek、Moonshot、智谱 GLM、硅基流动、百炼、Claude、Gemini 以及 Ollama / LM Studio 本地模型。',
          steps: [
            '点左侧「工具 → <b>＋ AI 助手</b>」进入对话页，先点「配置」选择服务商、填入 API Key 与模型名（Key 只存在本机，通过同源代理 <code>/api/llm</code> 转发避免跨域）。',
            '在聊天框直接提需求（如「帮我查看当前工作区贴图颜色并做一套蓝水晶换色变种」），AI 可自动调用查看纹理、分析配色、换色、生成变种、像素绘制与构建模型等工具。',
            '涉及修改/新建作品的操作会弹出 <b>同意门控卡片</b>，确认后才会真正写入你的工作区。'
          ]
        },
        {
          title: 'DSH 资产索引与 MCP 桥接（消除 AI 幻觉路径）',
          badge: 'DSH 联动',
          action: { id: 'dsh', label: '打开 DSH 资产索引' },
          summary: '在像素工坊画好定稿后同步到 DSH 索引，DSH 右侧栏就会出现「像素工坊」面板，可直接插图引用与复制实文件到模组工程。',
          steps: [
            '在像素工坊把贴图、动画或模型定稿保存后，点击右侧快捷栏 <b>DSH 资产索引</b>。',
            '把「默认命名空间」改成你的真实英文 Mod ID（如 <code>mymod</code>，避免中文工作区名被清洗成数字），选择索引范围后点绿色 <b>同步到 DSH 索引</b>（写入 <code>~/.clastar-studio/dsh-bridge/</code>）。',
            '切换到 <b>DSH（DeepSeek Harness）</b> 右侧栏的 <b>「像素工坊」</b> 标签页，即可看到像素缩略图与 <code>clastar:&lt;类型&gt;:&lt;命名空间&gt;:&lt;名称&gt;</code> 句柄。',
            '点击 <b>插入</b> 把 <code>[clastar:...]</code> 放入对话，告诉 DSH「把该资产接入我的模组并复制到 <code>src/main/resources</code>」，AI 会通过 <code>clastar_list_assets / clastar_get_asset / clastar_copy_asset_to_mod_dir</code> 精准读取并落盘真实文件。',
            '如需接入 Cursor / Claude Desktop 等其他支持 MCP 的客户端，在像素工坊桥接弹窗点击 <b>复制 MCP 配置</b>（运行 <code>tools/clastar_mcp.py</code>）即可。'
          ]
        }
      ]
    },
    {
      id: 'ext_shortcuts_app',
      title: '插件、快捷键与多端使用',
      subtitle: '管理内置工具与可选扩展、自定义全部快捷键，以及桌面端与手机 PWA 安装方法。',
      cards: [
        {
          title: '内置扩展开关与可选插件中心',
          badge: '扩展生态',
          action: { id: 'plugins', label: '打开扩展中心' },
          summary: '不需要的工具可在设置里隐藏；额外插件（机械动力方块扩展 / GIF 导出 / MC 方块素材库）可在扩展中心按需安装。',
          steps: [
            '打开右上角 <b>⚙ 设置</b>，在扩展列表可单独关闭或开启「色彩拓展 / 一键换色 / 变种工坊 / 素材库 / 模型库 / 一键光源 / 彩色渐变叠加」。',
            '进入 <b>扩展中心</b> 可从内置目录安装或导入本地插件 ZIP / GitHub 插件，安装后的工具会自动出现在左侧「工具」栏并标记「扩展」。'
          ]
        },
        {
          title: '自定义快捷键与速查卡',
          badge: '效率键位',
          action: { id: 'shortcuts', label: '打开快捷键中心' },
          summary: '全局与编辑器快捷键均可自定义，改完后编辑器按钮上的键位徽标会实时同步。',
          steps: [
            '随时按键盘 <code>?</code> 可弹出当前全部快捷键速查卡；也可在设置里进入 <b>快捷键中心</b>。',
            '点击任意功能右侧的按键框，直接按下新组合键即可改绑；如有冲突会高亮提醒，点重置按钮可恢复默认。'
          ],
          keys: [
            ['?', '打开快捷键速查卡'],
            ['Ctrl + ,', '打开设置']
          ]
        },
        {
          title: '桌面版 .exe 与手机端 / 静态离线使用',
          badge: '运行环境',
          action: { id: 'settings', label: '检查更新 / 安装' },
          summary: '一套代码同时支持 Windows 桌面 exe、GitHub Pages 在线版与手机 PWA 安装。',
          steps: [
            '<b>Windows 桌面版</b>：直接运行 <code>desktop/target/release/clastar-studio.exe</code>（或开始菜单快捷方式），请保持同级 <code>dist/</code> 目录完整，不要单拎 exe 文件复制走。',
            '<b>手机 / 浏览器 PWA</b>：用手机 Edge / Chrome 打开在线地址（HTTPS 或 localhost），在浏览器菜单点「添加到手机 / 安装应用」即可离线使用。',
            '<b>检查版本更新</b>：在设置中点「检查更新」可比对 GitHub 最新 Release。'
          ]
        }
      ]
    }
  ];

  const TOUR_STEPS = [
    {
      title: '1. 认识三栏界面',
      target: '#leftRail',
      body: '<p>欢迎来到 <b>像素工坊</b>！整个界面分三块：</p><ul><li><b>左侧栏</b>：管理工作区（项目）、打开各种辅助工具、查看最近打开与回收站。</li><li><b>中间区</b>：多标签页画布，可同时开多张贴图/方块，互不干扰。</li><li><b>右侧栏</b>：常用快捷操作与当前工作区概览。</li></ul>',
      actions: [
        { id: 'focus_right', label: '看看右侧快捷栏', fn: () => focusTarget('#rightRail') }
      ]
    },
    {
      title: '2. 建工作区与新建内容',
      target: '#quickNew',
      body: '<p>所有作品都收在<b>工作区</b>里（建议一个模组建一个工作区）。</p><ul><li>先新建工作区，再点右侧 <code>＋ 新建内容</code>。</li><li>支持：<code>16×16 传统纹理</code>、<code>最大 2048×2048 自定义纹理</code>、<code>16 帧动画</code>、<code>MC 方块 3D</code> 与 <code>盔甲实体</code>。</li></ul>',
      actions: [
        { id: 'tour_new', label: '立即新建工作区 / 内容', pri: true, fn: () => runAction('new_content_or_ws') }
      ]
    },
    {
      title: '3. 绘画、面板停靠与保存',
      target: '#content',
      body: '<p>双击首页的任意卡片就会打开对应编辑器：</p><ul><li>常用键：<code>B</code> 画笔 · <code>E</code> 橡皮 · <code>G</code> 填充 · <code>Alt+点击</code> 取色 · <code>Ctrl+Z</code> 撤销。</li><li>面板技巧：拖动面板标题可<b>合并标签组/换栏</b>，点 <code>↗</code> 可弹出小窗。</li><li><b>切记</b>：画完务必点编辑器顶栏绿色的 <code>保存回仓库</code>！</li></ul>',
      actions: []
    },
    {
      title: '4. 一键换色、变种与导出资源包',
      target: '#quickPack',
      body: '<p>做出一张底图后，可以快速裂变出整套模组贴图：</p><ul><li>右键卡片可<b>一键换色</b>，或用左侧<b>变种工坊</b>按材质色阶批量生成。</li><li>点首页右上 <code>多选</code> 勾选作品，再点右侧 <code>导出资源包</code> 即可生成标准 MC ZIP。</li></ul>',
      actions: [
        { id: 'tour_recolor', label: '试试一键换色', fn: () => runAction('recolor') },
        { id: 'tour_variant', label: '看看变种工坊', fn: () => runAction('variant') }
      ]
    },
    {
      title: '5. AI 助手与 DSH / Blockbench 联动',
      target: '#quickDshBridge',
      body: '<p>在像素工坊定稿后，可直接把资产交给 AI 或 DSH：</p><ul><li>点左侧 <code>＋ AI 助手</code> 可接入你自己的大模型帮忙调色、画图。</li><li>点右侧 <code>DSH 资产索引</code> 改好英文命名空间并同步，即可在 DSH 右侧栏直接插入 <code>[clastar:...]</code> 引用，不再怕 AI 瞎编路径！</li></ul>',
      actions: [
        { id: 'tour_dsh', label: '打开 DSH 资产索引', fn: () => runAction('dsh') },
        { id: 'tour_manual', label: '打开全功能详细教程', pri: true, fn: () => { stopTour(); openManual(); } }
      ]
    }
  ];

  let activeChapterId = CHAPTERS[0].id;
  let searchQuery = '';
  let manualPane = null;
  let tourIndex = -1;
  let tourEl = null;
  let focusedEl = null;

  function readState(){
    try{
      return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    }catch(_){ return null; }
  }
  function writeState(choice){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify({
        v: 1, seen: true, choice: choice || 'seen', at: new Date().toISOString()
      }));
    }catch(_){}
  }

  async function isDesktopEnv(){
    if(typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__)) return true;
    try{
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 1200) : null;
      const res = await fetch('/api/llm/health', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
      if(timer) clearTimeout(timer);
      if(!res.ok) return false;
      const data = await res.json();
      return !!(data && data.desktop === true);
    }catch(_){
      return false;
    }
  }

  function runAction(id){
    if(id === 'home'){ if(typeof goHome === 'function') goHome(); return; }
    if(id === 'new_ws'){ if(typeof newWorkspace === 'function') newWorkspace(); return; }
    if(id === 'new_content'){
      if(typeof currentWS === 'function' && !currentWS()){
        toast('先新建一个工作区，就能创建内容了');
        if(typeof newWorkspace === 'function') newWorkspace();
        return;
      }
      if(typeof openNewDialog === 'function') openNewDialog();
      return;
    }
    if(id === 'new_content_or_ws'){
      if(typeof currentWS === 'function' && !currentWS()){ if(typeof newWorkspace === 'function') newWorkspace(); }
      else if(typeof openNewDialog === 'function'){ openNewDialog(); }
      return;
    }
    if(id === 'color'){ if(typeof openColorStudio === 'function') openColorStudio(); return; }
    if(id === 'recolor'){ if(typeof openRecolorTool === 'function') openRecolorTool(); return; }
    if(id === 'variant'){ if(typeof openVariantLab === 'function') openVariantLab(); return; }
    if(id === 'assets'){ if(typeof PWAssets !== 'undefined' && PWAssets.open) PWAssets.open(); return; }
    if(id === 'models'){ if(typeof PWModels !== 'undefined' && PWModels.open) PWModels.open(); return; }
    if(id === 'pack'){ if(typeof sidebarQuickPack === 'function') sidebarQuickPack(); return; }
    if(id === 'settings'){ if(typeof openSettings === 'function') openSettings(); return; }
    if(id === 'agent'){ if(typeof PWAgent !== 'undefined' && PWAgent.open) PWAgent.open(); return; }
    if(id === 'dsh'){ if(typeof PWBridge !== 'undefined' && PWBridge.openModal) PWBridge.openModal(); return; }
    if(id === 'plugins'){ if(typeof PWPlugins !== 'undefined' && PWPlugins.openPluginCenter) PWPlugins.openPluginCenter(); return; }
    if(id === 'shortcuts'){ if(typeof PWShortcuts !== 'undefined' && PWShortcuts.openShortcutCenter) PWShortcuts.openShortcutCenter(); return; }
  }

  /* ---------------- 首次打开桌面版提示 ---------------- */
  function showWelcomeModal(){
    if(!$('#modal')) return;
    $('#dlgTitle').innerHTML = iconSVG('book', 14) + ' 欢迎使用像素工坊';
    $('#dlgBody').innerHTML =
      '<div class="tut-wel-intro">检测到这是你首次启动 <b>像素工坊桌面版</b>。需要我用 1 分钟带你熟悉各个模块，还是先自己体验？</div>' +
      '<div class="tut-wel-grid">' +
        '<div class="tut-wel-box"><b>5 步简易教程（推荐新手）</b><span>右下角引导浮卡，一步步带你建工作区、画贴图、保存、换色导出以及对接 DSH。</span></div>' +
        '<div class="tut-wel-box"><b>全功能详细手册</b><span>按模块拆解全部 10 大功能的具体点按位置、快捷键与原版 JAR 导入说明，并带一键直达。</span></div>' +
      '</div>' +
      '<div class="tut-wel-foot"><span>随时可点右上角 <b>教程</b> 按钮或「设置 → 使用教程」再次打开。</span>' +
      '<button type="button" class="btn sm" id="welOpenFullManual">直接看全功能手册</button></div>';
    const cancelBtn = $('#dlgCancel');
    const okBtn = $('#dlgOk');
    cancelBtn.style.display = '';
    cancelBtn.textContent = '暂不，自己探索';
    okBtn.textContent = '进入简易教程';

    const prevCancel = cancelBtn.onclick;
    const restoreCancel = () => { cancelBtn.onclick = prevCancel || closeDialog; };
    cancelBtn.onclick = () => {
      writeState('skip');
      restoreCancel();
      closeDialog();
    };
    dlgOkFn = () => {
      writeState('tour');
      restoreCancel();
      closeDialog();
      startTour();
    };
    $('#modal').classList.add('on');
    const fullBtn = $('#welOpenFullManual');
    if(fullBtn){
      fullBtn.onclick = () => {
        writeState('manual');
        restoreCancel();
        closeDialog();
        openManual();
      };
    }
    paintIcons($('#modal'));
  }

  async function maybePromptFirstRun(){
    const st = readState();
    if(st && st.seen) return false;
    const desktop = await isDesktopEnv();
    if(!desktop) return false;
    if($('#modal') && $('#modal').classList.contains('on')) return false;
    showWelcomeModal();
    return true;
  }

  /* ---------------- 5 步交互简易教程 ---------------- */
  function clearFocus(){
    if(focusedEl){
      focusedEl.classList.remove('pw-tour-focus');
      focusedEl = null;
    }
  }
  function focusTarget(selector){
    clearFocus();
    if(!selector) return;
    const el = document.querySelector(selector);
    if(!el) return;
    const wsEl = document.querySelector('.workspace');
    if(wsEl){
      if(selector === '#leftRail' && wsEl.classList.contains('left-off')) wsEl.classList.remove('left-off');
      if((selector === '#rightRail' || selector.startsWith('#quick')) && wsEl.classList.contains('right-off')) wsEl.classList.remove('right-off');
    }
    el.classList.add('pw-tour-focus');
    focusedEl = el;
    try{ el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }catch(_){}
  }

  function renderTourStep(){
    if(tourIndex < 0 || tourIndex >= TOUR_STEPS.length){ stopTour(); return; }
    const step = TOUR_STEPS[tourIndex];
    focusTarget(step.target);
    if(!tourEl){
      tourEl = document.createElement('aside');
      tourEl.id = 'pwTourCard';
      tourEl.className = 'pw-tour-card';
      document.body.appendChild(tourEl);
    }
    const actsHtml = (step.actions || []).map((a, idx) =>
      '<button type="button" class="btn sm ' + (a.pri ? 'pri' : '') + '" data-tour-act="' + idx + '">' + esc(a.label) + '</button>'
    ).join('');
    tourEl.innerHTML =
      '<div class="pw-tour-head"><b>' + esc(step.title) + '</b><span class="pw-tour-step">' + (tourIndex + 1) + ' / ' + TOUR_STEPS.length + '</span></div>' +
      '<div class="pw-tour-bd">' + step.body + (actsHtml ? '<div class="pw-tour-try">' + actsHtml + '</div>' : '') + '</div>' +
      '<div class="pw-tour-ft">' +
        '<button type="button" class="btn sm pw-tour-skip" data-tour-nav="close">结束引导</button>' +
        '<button type="button" class="btn sm" data-tour-nav="prev"' + (tourIndex === 0 ? ' disabled' : '') + '>上一步</button>' +
        '<button type="button" class="btn sm pri" data-tour-nav="next">' + (tourIndex === TOUR_STEPS.length - 1 ? '完成' : '下一步') + '</button>' +
      '</div>';
    tourEl.querySelectorAll('[data-tour-act]').forEach(btn => {
      btn.onclick = () => {
        const act = step.actions[+btn.dataset.tourAct];
        if(act && typeof act.fn === 'function') act.fn();
      };
    });
    const prevBtn = tourEl.querySelector('[data-tour-nav="prev"]');
    const nextBtn = tourEl.querySelector('[data-tour-nav="next"]');
    const closeBtn = tourEl.querySelector('[data-tour-nav="close"]');
    if(prevBtn) prevBtn.onclick = () => { if(tourIndex > 0){ tourIndex--; renderTourStep(); } };
    if(nextBtn) nextBtn.onclick = () => {
      if(tourIndex < TOUR_STEPS.length - 1){ tourIndex++; renderTourStep(); }
      else{ stopTour(); toast('已完成 5 步引导！随时可在顶栏「教程」查阅全部功能'); }
    };
    if(closeBtn) closeBtn.onclick = stopTour;
  }

  function startTour(){
    writeState('tour');
    if(typeof goHome === 'function') goHome();
    tourIndex = 0;
    renderTourStep();
  }

  function stopTour(){
    tourIndex = -1;
    clearFocus();
    if(tourEl){
      tourEl.remove();
      tourEl = null;
    }
  }

  /* ---------------- 全功能详细教程中心 ---------------- */
  function openManual(chapterId){
    if(chapterId && CHAPTERS.some(c => c.id === chapterId)) activeChapterId = chapterId;
    const exist = S.tabs.find(t => t.kind === 'tutorial');
    if(exist){
      activateTab(exist.id);
      if(manualPane) renderManual();
      return;
    }
    newTab('tutorial', '使用教程');
  }

  function cardMatchesQuery(card, chap, q){
    if(!q) return true;
    const hay = [
      chap.title, chap.subtitle,
      card.title, card.badge || '', card.summary || '',
      ...(card.steps || []),
      ...(card.keys || []).map(k => k.join(' ')),
      card.tip || ''
    ].join(' ').replace(/<[^>]+>/g, ' ').toLowerCase();
    return hay.includes(q);
  }

  function renderCardHTML(card, idx){
    const keysHtml = (card.keys && card.keys.length)
      ? '<div class="tut-keys">' + card.keys.map(k => '<span class="tut-keypill"><kbd>' + esc(k[0]) + '</kbd><span>' + esc(k[1]) + '</span></span>').join('') + '</div>'
      : '';
    const tipHtml = card.tip
      ? '<div class="tut-tip ' + (card.tipKind === 'warn' ? 'warn' : '') + '">' + card.tip + '</div>'
      : '';
    const actHtml = card.action
      ? '<button type="button" class="btn sm pri" data-tut-action="' + esc(card.action.id) + '">' + esc(card.action.label) + '</button>'
      : '';
    return '<article class="tut-card">' +
      '<div class="tut-card-head"><b>' + (idx + 1) + '. ' + esc(card.title) + '</b>' +
      (card.badge ? '<span class="tut-badge">' + esc(card.badge) + '</span>' : '') +
      actHtml + '</div>' +
      '<div class="tut-card-bd"><div class="tut-summary">' + card.summary + '</div>' +
      '<ol class="tut-steps">' + (card.steps || []).map(s => '<li>' + s + '</li>').join('') + '</ol>' +
      keysHtml + tipHtml + '</div></article>';
  }

  function renderManual(){
    if(!manualPane) return;
    const q = searchQuery.trim().toLowerCase();
    const tocEl = manualPane.querySelector('#tutToc');
    const bodyEl = manualPane.querySelector('#tutBody');
    if(!tocEl || !bodyEl) return;

    if(q){
      tocEl.innerHTML = CHAPTERS.map((c, i) => {
        const cnt = c.cards.filter(card => cardMatchesQuery(card, c, q)).length;
        return '<button type="button" class="tut-toc-btn' + (c.id === activeChapterId ? ' on' : '') + '" data-tut-chap="' + esc(c.id) + '">' +
          '<span class="tut-toc-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="tut-toc-txt">' + esc(c.title) + '</span>' +
          '<span class="tut-badge">' + cnt + '</span></button>';
      }).join('');

      const hits = [];
      CHAPTERS.forEach(c => {
        c.cards.forEach((card, idx) => {
          if(cardMatchesQuery(card, c, q)) hits.push({ chap: c, card, idx });
        });
      });
      bodyEl.innerHTML = hits.length
        ? '<div class="tut-chap-head"><div><h2>搜索结果：' + esc(searchQuery.trim()) + '</h2><p>共找到 ' + hits.length + ' 条功能说明，点击条目右上角按钮可直接跳到对应功能。</p></div></div>' +
          '<div class="tut-cards">' + hits.map((h, i) => renderCardHTML(Object.assign({}, h.card, { badge: h.chap.title + (h.card.badge ? ' · ' + h.card.badge : '') }), i)).join('') + '</div>'
        : '<div class="tut-empty">没有匹配「' + esc(searchQuery.trim()) + '」的功能教程，换个词试试（例如：动画、盔甲、换色、1200、DSH）。</div>';
    } else {
      const chap = CHAPTERS.find(c => c.id === activeChapterId) || CHAPTERS[0];
      activeChapterId = chap.id;
      tocEl.innerHTML = CHAPTERS.map((c, i) =>
        '<button type="button" class="tut-toc-btn' + (c.id === chap.id ? ' on' : '') + '" data-tut-chap="' + esc(c.id) + '">' +
        '<span class="tut-toc-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="tut-toc-txt">' + esc(c.title) + '</span></button>'
      ).join('');

      bodyEl.innerHTML =
        '<div class="tut-chap-head"><div><h2>' + esc(chap.title) + '</h2><p>' + esc(chap.subtitle) + '</p></div>' +
        '<button type="button" class="btn sm" id="tutStartTourInChap">启动 5 步简易引导</button></div>' +
        '<div class="tut-cards">' + chap.cards.map((card, i) => renderCardHTML(card, i)).join('') + '</div>';
      const tourBtn = bodyEl.querySelector('#tutStartTourInChap');
      if(tourBtn) tourBtn.onclick = startTour;
    }

    tocEl.querySelectorAll('[data-tut-chap]').forEach(btn => {
      btn.onclick = () => {
        activeChapterId = btn.dataset.tutChap;
        searchQuery = '';
        const inp = manualPane.querySelector('#tutSearchInput');
        if(inp) inp.value = '';
        renderManual();
      };
    });

    bodyEl.querySelectorAll('[data-tut-action]').forEach(btn => {
      btn.onclick = () => runAction(btn.dataset.tutAction);
    });
  }

  function mountCenter(t, eds){
    const pane = document.createElement('div');
    pane.className = 'ed-pane tutorial-pane on';
    pane.dataset.tab = t.id;
    pane.innerHTML =
      '<div class="tut-page">' +
        '<div class="tut-top">' +
          '<div class="tut-top-title"><b>像素工坊 · 全功能使用教程</b><span>涵盖全部编辑器、批量换色变种、原版 JAR 导入、Blockbench、AI 助手与 DSH 联动</span></div>' +
          '<div class="tut-top-acts">' +
            '<label class="tut-search">' + iconSVG('search', 12) + '<input id="tutSearchInput" placeholder="搜索功能或关键词（如：动画 / 1200 / DSH）" value="' + esc(searchQuery) + '"></label>' +
            '<button type="button" class="btn sm pri" id="tutRunTourBtn">5 步简易教程</button>' +
          '</div>' +
        '</div>' +
        '<div class="tut-main"><nav class="tut-toc" id="tutToc"></nav><section class="tut-body" id="tutBody"></section></div>' +
      '</div>';
    eds.appendChild(pane);
    manualPane = pane;
    t._pane = pane;

    const inp = pane.querySelector('#tutSearchInput');
    if(inp){
      inp.addEventListener('input', () => {
        searchQuery = inp.value;
        renderManual();
      });
    }
    const tourBtn = pane.querySelector('#tutRunTourBtn');
    if(tourBtn) tourBtn.onclick = startTour;

    renderManual();
  }

  function settingsRowHTML(){
    return '<div class="opt" data-set="tutorial"><div class="oi">' + iconSVG('book', 16) + '</div>' +
      '<div class="ot"><b>使用教程</b><span>打开 5 步新手引导或查看全功能详细说明书</span></div></div>';
  }

  function resetFirstRun(){
    try{ localStorage.removeItem(LS_KEY); }catch(_){}
  }

  return {
    chapters: CHAPTERS,
    tourSteps: TOUR_STEPS,
    maybePromptFirstRun,
    showWelcomeModal,
    startTour,
    stopTour,
    openManual,
    mountCenter,
    settingsRowHTML,
    resetFirstRun
  };
})();
