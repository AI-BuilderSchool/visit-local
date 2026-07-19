// Vercel 서버리스 함수: 브라우저 대신 서버에서 YouTube Data API를 호출한다.
// API 키는 절대 클라이언트로 내려보내지 않고, 필요한 값만 가공해 응답한다.
const { regions, regionCode, maxResults } = require('./youtube.config');

const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET 요청만 허용됩니다.' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const regionKey = typeof req.query.region === 'string' ? req.query.region : 'cheonan';
  const region = regions[regionKey];
  if (!region) {
    res.status(400).json({ error: '지원하지 않는 지역입니다.' });
    return;
  }

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    videoDuration: 'short',
    order: 'relevance',
    regionCode: regionCode,
    relevanceLanguage: 'ko',
    maxResults: String(maxResults),
    q: region.query,
  });

  try {
    const upstream = await fetch(YOUTUBE_SEARCH_ENDPOINT + '?' + params.toString());
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'YouTube API 호출에 실패했습니다.' });
      return;
    }

    const data = await upstream.json();
    const items = (data.items || [])
      .filter(function (it) { return it.id && it.id.videoId; })
      .map(function (it) {
        const thumbs = it.snippet.thumbnails || {};
        const thumb = thumbs.high || thumbs.medium || thumbs.default || {};
        return {
          videoId: it.id.videoId,
          title: it.snippet.title,
          channelTitle: it.snippet.channelTitle,
          thumbnail: thumb.url || '',
        };
      });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    res.status(200).json({ region: regionKey, label: region.label, items: items });
  } catch (err) {
    res.status(502).json({ error: '영상 정보를 가져오는 중 오류가 발생했습니다.' });
  }
};
