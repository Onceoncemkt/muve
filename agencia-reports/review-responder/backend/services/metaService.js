const axios = require('axios');
const { getDb } = require('../database');

const GRAPH = 'https://graph.facebook.com/v19.0';

function getCredentials(clientId) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM client_credentials WHERE client_id = ? AND platform = 'facebook'"
  ).get(clientId);
}

async function verifyPageToken(clientId) {
  const creds = getCredentials(clientId);
  if (!creds?.meta_page_access_token || !creds?.meta_page_id) {
    throw new Error('Meta credentials not configured');
  }

  const { data } = await axios.get(`${GRAPH}/${creds.meta_page_id}`, {
    params: { fields: 'name,id', access_token: creds.meta_page_access_token }
  });
  return { valid: true, pageName: data.name, pageId: data.id };
}

async function fetchFacebookComments(clientId) {
  const db = getDb();
  const creds = getCredentials(clientId);
  if (!creds?.meta_page_access_token || !creds?.meta_page_id) return 0;

  let newCount = 0;
  let url = `${GRAPH}/${creds.meta_page_id}/feed`;
  let params = {
    fields: 'id,message,created_time,comments{id,message,from,created_time}',
    access_token: creds.meta_page_access_token,
    limit: 25
  };

  // Fetch last 2 pages of feed to capture recent posts
  for (let page = 0; page < 2; page++) {
    let res;
    try {
      res = await axios.get(url, { params });
    } catch (err) {
      console.warn('Facebook feed error:', err.response?.data || err.message);
      break;
    }

    const posts = res.data.data || [];
    for (const post of posts) {
      const comments = post.comments?.data || [];
      for (const comment of comments) {
        // Skip comments made by the page itself
        if (comment.from?.id === creds.meta_page_id) continue;

        const existing = db.prepare(
          "SELECT id FROM reviews WHERE platform = 'facebook' AND external_id = ?"
        ).get(comment.id);
        if (existing) continue;

        db.prepare(`
          INSERT INTO reviews (client_id, platform, external_id, author_name, content, status)
          VALUES (?, 'facebook', ?, ?, ?, 'pending')
        `).run(clientId, comment.id, comment.from?.name || 'Anónimo', comment.message || null);
        newCount++;
      }
    }

    const nextUrl = res.data.paging?.next;
    if (!nextUrl) break;
    url = nextUrl;
    params = {};
  }

  return newCount;
}

async function fetchInstagramComments(clientId) {
  const db = getDb();
  const creds = getCredentials(clientId);
  if (!creds?.meta_page_access_token || !creds?.meta_instagram_account_id) return 0;

  let newCount = 0;

  const { data: mediaData } = await axios.get(
    `${GRAPH}/${creds.meta_instagram_account_id}/media`,
    {
      params: {
        fields: 'id,caption,timestamp,comments{id,text,username,timestamp}',
        access_token: creds.meta_page_access_token,
        limit: 25
      }
    }
  );

  const posts = mediaData.data || [];
  for (const post of posts) {
    const comments = post.comments?.data || [];
    for (const comment of comments) {
      const existing = db.prepare(
        "SELECT id FROM reviews WHERE platform = 'instagram' AND external_id = ?"
      ).get(comment.id);
      if (existing) continue;

      db.prepare(`
        INSERT INTO reviews (client_id, platform, external_id, author_name, content, status)
        VALUES (?, 'instagram', ?, ?, ?, 'pending')
      `).run(clientId, comment.id, comment.username || 'Anónimo', comment.text || null);
      newCount++;
    }
  }

  return newCount;
}

async function publishFacebookReply(clientId, commentId, replyText) {
  const creds = getCredentials(clientId);
  if (!creds?.meta_page_access_token) throw new Error('Meta not connected');

  await axios.post(`${GRAPH}/${commentId}/comments`, {
    message: replyText,
    access_token: creds.meta_page_access_token
  });
}

async function publishInstagramReply(clientId, commentId, replyText) {
  const creds = getCredentials(clientId);
  if (!creds?.meta_page_access_token) throw new Error('Meta not connected');

  await axios.post(`${GRAPH}/${commentId}/replies`, {
    message: replyText,
    access_token: creds.meta_page_access_token
  });
}

module.exports = {
  verifyPageToken,
  fetchFacebookComments,
  fetchInstagramComments,
  publishFacebookReply,
  publishInstagramReply
};
