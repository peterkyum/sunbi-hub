import type { VercelRequest, VercelResponse } from '@vercel/node'

const APP_URLS: Record<string, string> = {
  base: 'https://sunbi-base.vercel.app',
  order: 'https://sunbi-crew-order.vercel.app',
  'floor-plan': 'https://sunbi-floor-plan.vercel.app',
  store: 'https://sunbi-store-abb.vercel.app',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = req.query.app as string
  const targetUrl = APP_URLS[app]

  if (!targetUrl) {
    return res.status(404).send('App not found')
  }

  try {
    const response = await fetch(targetUrl)
    if (!response.ok) {
      return res.status(502).send('Failed to fetch app')
    }

    let html = await response.text()
    const basePath = `/app/${app}/`

    // <base href> 주입 또는 수정 (같은 도메인 서브패스로 자산 경로 변환)
    if (html.includes('<base href=')) {
      html = html.replace(/<base href="[^"]*"/, `<base href="${basePath}"`)
    } else if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n<base href="${basePath}">`)
    }

    // Vite 앱의 절대 경로 변환: /assets/... → /app/<name>/assets/...
    html = html.replace(/src="\/assets\//g, `src="${basePath}assets/`)
    html = html.replace(/href="\/assets\//g, `href="${basePath}assets/`)
    // manifest.json 절대 경로 변환
    html = html.replace(/href="\/manifest/g, `href="${basePath}manifest`)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, must-revalidate')
    res.send(html)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(502).send(`Proxy error: ${msg}`)
  }
}
