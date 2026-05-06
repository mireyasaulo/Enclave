import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SendVerificationCodeResult = {
  delivered: boolean;
  debugCode: string | null;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private transporterReady = false;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(
    email: string,
    code: string,
  ): Promise<SendVerificationCodeResult> {
    const transporter = this.resolveTransporter();
    if (!transporter) {
      this.logger.log(`[Mock] Email verification code for ${email}: ${code}`);
      return { delivered: false, debugCode: code };
    }

    const fromAddress = this.config.get<string>('MAIL_FROM_ADDRESS');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? '隐界 Yinjie';
    const from = fromAddress ? `${fromName} <${fromAddress}>` : fromName;

    const subject = '【隐界】登录验证码';
    const text = `您的登录验证码是 ${code}，10 分钟内有效。如非本人操作请忽略此邮件。`;
    const html = `
      <div style="font-family: -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif; line-height:1.6; color:#1f2937;">
        <p>您正在登录 <strong>隐界</strong>，验证码：</p>
        <p style="font-size:28px; letter-spacing:6px; font-weight:600; color:#1d4ed8;">${code}</p>
        <p style="color:#6b7280; font-size:13px;">10 分钟内有效。如非本人操作请忽略此邮件。</p>
      </div>
    `.trim();

    try {
      await transporter.sendMail({ from, to: email, subject, text, html });
    } catch (error) {
      this.logger.error(
        `Email send failed to ${email}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('邮件验证码发送失败，请稍后重试。');
    }

    return { delivered: true, debugCode: null };
  }

  private resolveTransporter(): Transporter | null {
    if (this.transporterReady) return this.transporter;
    this.transporterReady = true;

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST 未配置，邮件发送进入 mock 模式（仅打印验证码到日志）。',
      );
      return null;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? '465');
    const secureRaw = this.config.get<string>('SMTP_SECURE') ?? 'true';
    const secure = secureRaw !== 'false';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }
}
