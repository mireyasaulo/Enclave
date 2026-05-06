import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';
import { RequireRole } from '../decorators/require-role.decorator';
import { WikiRoleGuard } from '../guards/wiki-role.guard';
import { WikiFieldProtectionService } from '../services/wiki-field-protection.service';

@Controller('wiki/field-protection')
export class WikiFieldProtectionController {
  constructor(private readonly svc: WikiFieldProtectionService) {}

  /** Public read: edit form needs to know which paths are protected */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query('characterId') characterId?: string) {
    return characterId ? this.svc.listForCharacter(characterId) : this.svc.list();
  }

  @Get('effective/:characterId')
  @UseGuards(OptionalJwtAuthGuard)
  async effective(@Param('characterId') characterId: string) {
    const map = await this.svc.getEffectivePolicy(characterId);
    return Array.from(map.entries()).map(([fieldPath, minRoleToEdit]) => ({
      fieldPath,
      minRoleToEdit,
    }));
  }

  @Post()
  @UseGuards(JwtAuthGuard, WikiRoleGuard)
  @RequireRole('admin')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      characterId: string;
      fieldPath: string;
      minRoleToEdit: string;
      reason?: string | null;
    },
  ) {
    return this.svc.create({
      characterId: body.characterId,
      fieldPath: body.fieldPath,
      minRoleToEdit: body.minRoleToEdit,
      reason: body.reason ?? null,
      createdBy: actor.id,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WikiRoleGuard)
  @RequireRole('admin')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      characterId: string;
      fieldPath: string;
      minRoleToEdit: string;
      reason: string | null;
    }>,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WikiRoleGuard)
  @RequireRole('admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
