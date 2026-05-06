import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class MockEmailProviderService {
  private readonly logger = new Logger(MockEmailProviderService.name);

  async sendCode(email: string, code: string) {
    this.logger.log(`Mock email code for ${email}: ${code}`);
    return { debugCode: code };
  }
}
