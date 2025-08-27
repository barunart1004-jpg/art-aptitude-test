// netlify/functions/send-email.js
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

exports.handler = async (event) => {
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

    // 1) data URI 프리픽스 제거
    const base64 = pdfBase64.includes(',')
      ? pdfBase64.split(',')[1]
      : pdfBase64;

    // 2) 크기 가드(≈ base64 길이→바이트 추정)
    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes > 15 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        body: JSON.stringify({ error: 'Attachment too large (>15MB)' })
      };
    }

    const from = process.env.RESEND_FROM || 'onboarding@resend.dev'; // 도메인 검증 전 테스트용

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
        to,                        // 문자열/배열 모두 허용됨
        subject: subject || '테스트 결과 안내',
        text,
        attachments: [{
          filename: fileName || 'result.pdf',
          content: base64,
          contentType: 'application/pdf' // ← 명시
        }]
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
