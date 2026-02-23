# Random
在 Vercel 平台上部署一个具有分类功能的随机图片 API。通过这个 API，用户可以根据不同的分类获取随机图片链接，并且还可以从所有分类中随机获取一张图片。

## Demo

[https://random-pictures-iota.vercel.app](https://random-pictures-iota.vercel.app/)

## 部署

先 `Fork` 本项目，再登录 [Vercel](https://vercel.com/) 网站新建项目。

## 开发

- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 运行测试：`npm test`
- 按文件运行测试：`node --test randomImage.test.js`
- 按测试名过滤：`node --test --test-name-pattern "health" randomImage.test.js`

## 使用方法

在 `api` 目录下创建 `*.txt` 文件作为分类（例如 `meinv.txt`、`dongman.txt`、`nature.txt`），每行一个图片链接。

> 分类名由文件名自动决定：`api/<category>.txt` 对应路由 `/<category>`。

示例：

```bash
https://example.com/image-1.jpg
https://example.com/image-2.jpg
```

## 路由

- `https://your-domain.vercel.app/` 显示项目主页说明
- `https://your-domain.vercel.app/health` 健康检查（返回 200）
- `https://your-domain.vercel.app/random` 在所有分类中随机返回一张图片
- `https://your-domain.vercel.app/<category>` 在指定分类中随机返回一张图片（如 `/meinv`、`/dongman`）

## 说明

- 唯一服务入口为 `api/randomImage.js`。
- 首页说明页面来自 `public/index.html`。
- `/random` 会忽略无效分类文件（空文件、无有效 URL、读取失败的分类），只要存在可用分类就会正常返回。
- 图片链接仅接受 `http/https` 协议，其他协议会被过滤。
- 分类名仅允许字母、数字、下划线和中划线（`[a-zA-Z0-9_-]`）。

## 许可证

[![license](https://img.shields.io/github/license/aizhiqian/random-pictures)](https://github.com/aizhiqian/random-pictures/blob/main/LICENSE)

random-pictures 使用 GPL-v3.0 协议开源，请遵守开源协议。
