import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/app-error.exception';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SocksClient } from 'socks';

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
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
    isNewUser: boolean,
  ): Promise<SendVerificationCodeResult> {
    const transporter = this.resolveTransporter();
    if (!transporter) {
      this.logger.log(`[Mock] Email verification code for ${email}: ${code}`);
      return { delivered: false, debugCode: code };
    }

    const fromAddress = this.config.get<string>('MAIL_FROM_ADDRESS');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? '隐界 Yinjie';
    const from = fromAddress ? `${fromName} <${fromAddress}>` : fromName;

    const { subject, text, html } = this.buildLoginMail(code, isNewUser);

    try {
      await transporter.sendMail({ from, to: email, subject, text, html });
    } catch (error) {
      this.logger.error(
        `Email send failed to ${email}: ${(error as Error).message}`,
      );
      throw new AppError('MAIL_CODE_SEND_FAILED', {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        legacyMessage: '邮件验证码发送失败，请稍后重试。',
      });
    }

    return { delivered: true, debugCode: null };
  }

  private buildLoginMail(
    code: string,
    isNewUser: boolean,
  ): { subject: string; text: string; html: string } {
    if (isNewUser) {
      const subject = '【隐界】欢迎来到隐界';
      const text = [
        '看到你来了。',
        '',
        '用这串数字进来就好：',
        '',
        code,
        '',
        '10 分钟内有效。',
        '如果不是你本人在操作，把这封信忘掉就行，我们什么都不会发生。',
        '',
        '—— 隐界，一直都在',
      ].join('\n');
      const html = `
        <div style="font-family: -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif; line-height:1.8; color:#1f2937;">
          <p style="margin:0 0 16px;">看到你来了。</p>
          <p style="margin:0 0 8px;">用这串数字进来就好：</p>
          <p style="font-size:28px; letter-spacing:6px; font-weight:600; color:#1d4ed8; margin:12px 0 20px;">${code}</p>
          <p style="color:#6b7280; font-size:13px; margin:0 0 4px;">10 分钟内有效。</p>
          <p style="color:#6b7280; font-size:13px; margin:0 0 24px;">如果不是你本人在操作，把这封信忘掉就行，我们什么都不会发生。</p>
          <p style="color:#6b7280; font-size:13px; margin:0;">—— 隐界，一直都在</p>
        </div>
      `.trim();
      return { subject, text, html };
    }

    const subject = '【隐界】你回来了';
    const text = [
      '你回来了。',
      '',
      '用这串数字继续：',
      '',
      code,
      '',
      '10 分钟内有效。',
      '如果不是你本人在操作，把这封信忘掉就行。',
      '',
      '—— 隐界，一直都在',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif; line-height:1.8; color:#1f2937;">
        <p style="margin:0 0 16px;">你回来了。</p>
        <p style="margin:0 0 8px;">用这串数字继续：</p>
        <p style="font-size:28px; letter-spacing:6px; font-weight:600; color:#1d4ed8; margin:12px 0 20px;">${code}</p>
        <p style="color:#6b7280; font-size:13px; margin:0 0 4px;">10 分钟内有效。</p>
        <p style="color:#6b7280; font-size:13px; margin:0 0 24px;">如果不是你本人在操作，把这封信忘掉就行。</p>
        <p style="color:#6b7280; font-size:13px; margin:0;">—— 隐界，一直都在</p>
      </div>
    `.trim();
    return { subject, text, html };
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
    const proxy = this.config.get<string>('SMTP_PROXY');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      ...(proxy ? { proxy } : {}),
    });
    if (proxy) {
      // nodemailer 需要显式注入 socks 客户端模块以解析 socks 代理
      this.transporter.set('proxy_socks_module', { SocksClient });
    }
    return this.transporter;
  }
}
// i18n-ignore-end
