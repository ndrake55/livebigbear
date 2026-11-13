import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const cfg = () => ({
  key: process.env.SES_ACCESS_KEY_ID ?? '',
  secret: process.env.SES_SECRET_ACCESS_KEY ?? '',
  region: process.env.SES_REGION ?? '',
  from: process.env.EMAIL_FROM ?? '',
});

/** Email is switched on only when all four Amazon SES settings are present. */
export function isMailConfigured(): boolean {
  const c = cfg();
  return Boolean(c.key && c.secret && c.region && c.from);
}

/** Where links in emails point. Always the live site, even when sent from a preview. */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : 'https://livebigbear.com';
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Adds the one-tap unsubscribe headers mail providers look for. */
  unsubscribeUrl?: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const c = cfg();
  if (!isMailConfigured()) throw new Error('Email is not configured');
  const client = new SESv2Client({
    region: c.region,
    credentials: { accessKeyId: c.key, secretAccessKey: c.secret },
  });
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: c.from,
      Destination: { ToAddresses: [mail.to] },
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: mail.text, Charset: 'UTF-8' },
            Html: { Data: mail.html, Charset: 'UTF-8' },
          },
          Headers: mail.unsubscribeUrl
            ? [
                { Name: 'List-Unsubscribe', Value: `<${mail.unsubscribeUrl}>` },
                { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
              ]
            : undefined,
        },
      },
    }),
  );
}

export function confirmationMail(to: string, confirmUrl: string): Mail {
  const text = [
    'Someone asked to get Live Big Bear storm-day emails at this address.',
    '',
    'If that was you, confirm here (the link works for 48 hours):',
    confirmUrl,
    '',
    'If it was not you, ignore this email. You will not hear from us again.',
    '',
    'Live Big Bear: road and weather conditions for the Big Bear Valley',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F2F5F8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12202E">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px">
<p style="margin:0 0 6px;font-size:20px;font-weight:800">Live Big Bear</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5">Someone asked to get Live Big Bear storm-day emails at this address. If that was you, confirm below.</p>
<p style="margin:0 0 18px"><a href="${confirmUrl}" style="display:inline-block;background:#1F4E9C;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:12px">Confirm my email</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4A5B6C">The link works for 48 hours. If it was not you, ignore this email and you will not hear from us again.</p>
</div></body></html>`;
  return { to, subject: 'Confirm your Live Big Bear emails', text, html };
}

export function manageMail(to: string, manageUrl: string): Mail {
  const text = [
    'Here is the link to your Live Big Bear alert settings (it works for 24 hours):',
    manageUrl,
    '',
    'Choose which roads and which days you hear about, pause your emails, or unsubscribe.',
    '',
    'If you did not ask for this, ignore this email. Nothing has changed.',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F2F5F8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12202E">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px">
<p style="margin:0 0 6px;font-size:20px;font-weight:800">Live Big Bear</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5">Here is the link to your alert settings. Choose which roads and which days you hear about, pause your emails, or unsubscribe.</p>
<p style="margin:0 0 18px"><a href="${manageUrl}" style="display:inline-block;background:#1F4E9C;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:12px">Manage my alerts</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4A5B6C">The link works for 24 hours. If you did not ask for this, ignore this email. Nothing has changed.</p>
</div></body></html>`;
  return { to, subject: 'Your Live Big Bear alert settings', text, html };
}
