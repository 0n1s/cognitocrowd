/**
 * Shared email HTML templates used across all transactional emails.
 */

const BRAND_NAME = 'TrainlyLabs';
const BRAND_COLOR = '#7c3aed'; // violet-600
const BG_LIGHT = '#f8f9fa';
const TEXT_DARK = '#1a1a2e';
const TEXT_MUTED = '#6b7280';
const TEXT_BODY = '#374151';

export function emailTemplate({
  title,
  body,
  ctaText,
  ctaUrl,
}: {
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${BRAND_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </td>
                  <td style="padding-left: 8px;">
                    <span style="font-size: 20px; font-weight: 700; color: ${TEXT_DARK}; letter-spacing: -0.5px;">${BRAND_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: ${TEXT_DARK}; line-height: 1.3;">${title}</h1>
              <div style="font-size: 15px; color: ${TEXT_BODY}; line-height: 1.7; margin-bottom: ${ctaText ? '24px' : '0'};">
                ${body}
              </div>
              ${ctaText && ctaUrl ? `
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: ${BRAND_COLOR}; border-radius: 8px; padding: 0;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="margin: 0 0 4px; font-size: 12px; color: ${TEXT_MUTED}; line-height: 1.5;">
                You received this email because you have a ${BRAND_NAME} account.
              </p>
              <p style="margin: 0; font-size: 12px; color: ${TEXT_MUTED};">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verificationEmailHtml({
  title,
  message,
}: {
  title: string;
  message: string;
}): string {
  return emailTemplate({
    title,
    body: `<p>${message}</p><p style="margin-top: 16px; color: ${TEXT_MUTED}; font-size: 13px;">If you did not request this email, you can safely ignore it.</p>`,
  });
}