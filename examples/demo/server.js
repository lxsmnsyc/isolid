const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer: createViteServer } = require('vite')

async function createServer() {
  const app = express()

  const vite = await createViteServer({
    server: { middlewareMode: 'ssr' }
  });

  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    const url = req.originalUrl
    try {
      const { default: render } = await vite.ssrLoadModule('/src/root.tsx')
      const template = await render();
      // const html = await vite.transformIndexHtml(url, template);
      const html = template;
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      // If an error is caught, let Vite fix the stracktrace so it maps back to
      // your actual source code.
      vite.ssrFixStacktrace(e)
      console.error(e)
      res.status(500).end(e.message)
    }
  });

  app.listen(3000);
}

createServer();
