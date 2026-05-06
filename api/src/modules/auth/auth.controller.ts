import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { EmailAuthService } from './email-auth.service';
import { JwtAuthGuard, type AuthenticatedUser } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailAuth: EmailAuthService,
  ) {}

  @Post('register')
  register(@Body() body: { username: string; password: string }) {
    return this.auth.register(body.username, body.password);
  }

  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @Post('email/send-code')
  sendEmailCode(@Body() body: { email: string }) {
    return this.emailAuth.sendCode(body?.email);
  }

  @Post('email/verify-code')
  verifyEmailCode(@Body() body: { email: string; code: string }) {
    return this.emailAuth.verifyCode(body?.email, body?.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
