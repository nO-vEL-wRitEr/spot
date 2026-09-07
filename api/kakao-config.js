module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const appKey = process.env.KAKAO_MAP_JS_KEY || '';
  if (!appKey) {
    res.statusCode = 503;
    return res.end(JSON.stringify({
      error: 'KAKAO_MAP_JS_KEY가 설정되지 않았습니다.',
      code: 'MISSING_KAKAO_MAP_KEY'
    }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ appKey }));
};
