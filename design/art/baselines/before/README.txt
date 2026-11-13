美术基准图基线 tag=before

复现命令（同一命令在修复前后各跑一次，即可得到可比的两组图）：
  node tests/harness/tools/art-baseline.mjs --tag=before

固定条件（两次运行必须一致，改任何一项都会让对比失效）：
  - URL           index.html?perf=off&perfdebug=1   ← perf=off 是唯一 IBL 开启且不降级的档位
  - 动态分辨率    RenderPipeline.setDynamicResolution(false)
  - HUD           gameHUD / crosshair / hitMarker / damageArcs / compassBar 全部 display:none
  - 敌人          enemies 全部移到 (240,240) 并置 dead
  - 机位          近景 pitch=-0.6109 (-35°)；远景 pitch=-0.0524 (-3°)；位置=出生点
  - 视口          1440x810

已知不可比项（别拿这两处判成败）：
  1. 云层会漂移 —— sky shader 的 uTime 随帧推进，两次运行的云形不同。
     判断大气/雾/地平线可以，别做像素级 diff。
  2. 地面散落战利品是随机生成的，前景可能多出一个物品。
  3. 视角模型（武器）的摆臂相位随帧数走，枪身姿态会有 1-2px 差异。

该看什么：
  - 近景：地面纹素颗粒是否清晰、近处道具（沙袋/路障/集装箱）是否与地面亮度同档、
          有没有「道具比地面亮一截」的贴纸感（= envMapIntensity 1.0 未修的特征）
  - 远景：天空/地平线色温、雾的远近、屋顶颜色、地表质感，三张地图应当一眼可辨