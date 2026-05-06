import { Body, Controller, Get, Patch } from '@nestjs/common';
import { WorldLanguageService } from './world-language.service';

@Controller('config/world-language')
export class WorldLanguageController {
  constructor(private readonly worldLanguage: WorldLanguageService) {}

  @Get()
  getConfig() {
    return this.worldLanguage.getConfig();
  }

  @Patch()
  setLanguage(@Body() body: { language?: unknown }) {
    return this.worldLanguage.setLanguage(body?.language);
  }
}
