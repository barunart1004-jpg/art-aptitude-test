// netlify/functions/send-email.js
// Node 18+ (Netlify 런타임)에서 fetch 내장
const ALLOWED_ORIGIN = '*'; // 같은 도메인에서만 쓴다면 필요없지만, 안전하게 허용

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { to, subject, fileName, pdfBase64, childName, campus } = JSON.parse(event.body || '{}');

    if (!to || !pdfBase64) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        body: JSON.stringify({ error: 'Missing fields: to, pdfBase64' })
      };
    }

    // 크기 가드(권장: 10~15MB 이하) — base64 길이로 대략 체크
    const approxBytes = Math.floor((pdfBase64.length * 3) / 4);
    if (approxBytes > 15 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        body: JSON.stringify({ error: 'Attachment too large (>15MB)' })
      };
    }

    const from = process.env.RESEND_FROM || 'onboarding@resend.dev'; // 도메인 인증 전 테스트 OK
    const text = [
      `${childName || '학생'}의 미술적성 테스트 결과를 보내드립니다.`,
      campus ? `캠퍼스: ${campus}` : '',
      '',
      '첨부된 PDF 파일을 확인해 주세요.'
    ].join('\n');

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject: subject || '테스트 결과 안내',
        text,
        attachments: [{ filename: fileName || 'result.pdf', content: pdfBase64 }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        statusCode: resp.status,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        body: JSON.stringify({ error: errText })
      };
    }

    const data = await resp.json();
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ id: data?.id || 'ok' })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ error: e.message })
    };
  }
};
