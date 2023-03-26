const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer: createViteServer } = require('vite')

async function createServer() {
  const app = express()
  let loadTemplate;
  let vite;
  
  if (process.env.NODE_ENV === "production") {
    // Use Vite's built asset in prod mode.
    loadTemplate = () => import("./dist/server/entry-server.mjs");
  } else {
    // Hookup the vite dev server.
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    })
    app.use(vite.middlewares)
    loadTemplate = () => vite.ssrLoadModule("./src/entry-server.tsx");
  }

  app.use('*', async (req, res) => {
    try {
      const { default: render } = await loadTemplate();
      res.status(200).set({ 'Content-Type': 'text/html' }).end(render())
    } catch (e) {
      // If an error is caught, let Vite fix the stracktrace so it maps back to
      // your actual source code.
      if (vite) {
        vite.ssrFixStacktrace(e);
      }
      console.error(e)
      res.status(500).end(e.message)
    }
  });

  app.listen(3000);
}

createServer();
