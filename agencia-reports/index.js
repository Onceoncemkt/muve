require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.META_ACCESS_TOKEN;
const RAW_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const BASE_URL = 'https://graph.facebook.com/v19.0';
if (!TOKEN || !RAW_AD_ACCOUNT) {
  throw new Error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID in .env');
}
function normalizeAdAccountId(accountId) {
  const trimmed = accountId.trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

const AD_ACCOUNT = normalizeAdAccountId(RAW_AD_ACCOUNT);
function getCampaignMetrics(campaign) {
  const conversions = Number(campaign.actions?.find(a => a.action_type === 'purchase')?.value || 0);
  const spend = Number(campaign.spend) || 0;
  const impressions = Number(campaign.impressions || 0);
  const clicks = Number(campaign.clicks || 0);
  const reach = Number(campaign.reach || 0);
  const roas = conversions > 0 && spend > 0 ? conversions / spend : null;

  return {
    campaignName: campaign.campaign_name || 'Sin nombre',
    spend,
    impressions,
    clicks,
    reach,
    conversions,
    roas,
  };
}

async function getCampaignInsights() {
  const url = `${BASE_URL}/${AD_ACCOUNT}/insights`;

  const params = {
    access_token: TOKEN,
    fields: 'campaign_name,spend,impressions,clicks,reach,actions',
    date_preset: 'last_30d',
    level: 'campaign',
  };

  const response = await axios.get(url, { params });
  return response.data.data ?? [];
}

function handleReportError(error) {
  const status = error.response?.status;
  const message = error.response?.data?.error?.message || error.message;
  console.error(`Error al generar el reporte${status ? ` (HTTP ${status})` : ''}: ${message}`);
}
async function generateReport() {
  console.log('📊 Generando reporte de Meta Ads...\n');
  const campaigns = await getCampaignInsights();

  if (campaigns.length === 0) {
    console.log('No se encontraron campañas para el período seleccionado.');
    return;
  }

  campaigns.forEach(c => {
    const metrics = getCampaignMetrics(c);
    const roas = metrics.roas !== null ? metrics.roas.toFixed(2) : 'N/A';

    console.log(`📌 Campaña: ${metrics.campaignName}`);
    console.log(`   💰 Gasto: $${metrics.spend.toFixed(2)}`);
    console.log(`   👁  Alcance: ${metrics.reach.toLocaleString()}`);
    console.log(`   🖱  Clics: ${metrics.clicks.toLocaleString()}`);
    console.log(`   🛒 ROAS: ${roas}`);
    console.log('---');
  });
}
if (require.main === module) {
  generateReport().catch(handleReportError);
}

module.exports = {
  getCampaignInsights,
  getCampaignMetrics,
  handleReportError,
};
