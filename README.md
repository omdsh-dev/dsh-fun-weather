# DSH Fun Weather

独立的 DeepSeek Harness Profile Bundle，提供当前天气、7 日预报、小时预报、城市设置，以及随天气变化的主题和壁纸效果。天气与地理搜索使用 Open-Meteo。

## 兼容性

- DSH `0.0.1-rc.2`
- Node.js `^22.19.0 || >=24`
- Web profile

插件使用自己的同源设置 API，不依赖 DSH 核心 settings RPC 的 namespace allowlist。设置仍由 Host 的 `dsh-settings` 服务持久化。

## 安装

```bash
dsh plugin --profile web add ./deepseek-ai-dsh-fun-weather-0.1.0.tgz
dsh web --profile web
```

`package.json#dsh.bundle.patch` 会自动应用 `cordis.patch.yml`。不要手工重复插入 `fun-weather` entry。

## 开发与验收

```bash
npm ci
DSH_WORKSPACE_ROOT=/path/to/deepseek-harness npm run setup:dsh-workspace
npm run typecheck
npm test
npm run build
npm pack
```

发布前应在全新的 `DSH_HOME` 中从 tarball 安装，确认 `dump-config` 只有一条 `fun-weather`，再做真实 Web 启动和 `/plugins/dsh-weather/api/settings` smoke。

## 权限、网络与限制

- Host 只向 Open-Meteo forecast 和 geocoding 两个固定域名族发出请求，不需要 API Key。
- 城市搜索、预报与浏览器定位依赖网络/浏览器权限；上游失败会保留最后一次成功天气并显示错误。
- 动态主题和壁纸会修改 DSH 主题状态及页面 CSS；关闭开关后恢复用户主题。
- 同源设置与天气 API 不包含独立认证，不应把 DSH Web 端口暴露到不可信网络。
- 本项目当前为本地私有原型，不配置远端仓库，也不自动发布 npm。
