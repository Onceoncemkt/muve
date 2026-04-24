const express = require('express');
const { getCampaignInsights, getCampaignMetrics } = require('./index');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildReportHtml(campaigns) {
  const rows = campaigns
    .map(campaign => {
      const metrics = getCampaignMetrics(campaign);
      const roas = metrics.roas !== null ? metrics.roas.toFixed(2) : 'N/A';

      return `
        <tr>
          <td>${escapeHtml(metrics.campaignName)}</td>
          <td>$${metrics.spend.toFixed(2)}</td>
          <td>${metrics.reach.toLocaleString()}</td>
          <td>${metrics.clicks.toLocaleString()}</td>
          <td>${metrics.impressions.toLocaleString()}</td>
          <td>${metrics.conversions.toLocaleString()}</td>
          <td>${roas}</td>
        </tr>
      `;
    })
    .join('');

  const body =
    rows ||
    `<tr><td colspan="7" style="text-align:center">No se encontraron campañas para el período seleccionado.</td></tr>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reporte Meta Ads</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; color: #111827; }
      h1 { margin: 0 0 0.5rem; }
      p { margin: 0 0 1.5rem; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 0.65rem; text-align: left; }
      th { background: #f9fafb; }
      tr:nth-child(even) { background: #fcfcfd; }
    </style>
  </head>
  <body>
    <h1>📊 Reporte de Meta Ads</h1>
    <p>Período: últimos 30 días</p>
    <table>
      <thead>
        <tr>
          <th>Campaña</th>
          <th>Gasto</th>
          <th>Alcance</th>
          <th>Clics</th>
          <th>Impresiones</th>
          <th>Compras</th>
          <th>ROAS</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  </body>
</html>`;
}

app.get('/', async (_req, res) => {
  try {
    const campaigns = await getCampaignInsights();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildReportHtml(campaigns));
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message;
    res
      .status(status)
      .send(`<!doctype html><html><body><h1>Error al generar el reporte</h1><p>${escapeHtml(message)}</p></body></html>`);
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Página disponible en http://localhost:${PORT}`);
});
