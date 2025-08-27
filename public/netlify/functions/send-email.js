// netlify/functions/send-email.js
// CommonJS 스타일: exports.handler
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    const { to, subject, fileName, pdfBase64, childName, campus } = JSON.parse(event.body || '{}');
    if (!to || !pdfBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
    }

    const from = 'JBMSOFT <noreply@yourdomain.com>'; // ★ Resend에서 도메인 인증 후 사용
    const text = [
      `${childName || '학생'}의 미술적성 테스트 결과를 보내드립니다.`,
      campus ? `캠퍼스: ${campus}` : '',
      '',
      '첨부된 PDF 파일을 확인해 주세요.'
    ].join('\n');

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`, // ★ Netlify 환경변수
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
      return { statusCode: resp.status, body: JSON.stringify({ error: errText }) };
    }

    const data = await resp.json();
    return { statusCode: 200, body: JSON.stringify({ id: data?.id || 'ok' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
