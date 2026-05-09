import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CloudInstanceEntity } from "../entities/cloud-instance.entity";
import { CloudUserEntity } from "../entities/cloud-user.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import { WorldApiProxyController } from "./world-api-proxy.controller";
import { WorldApiProxyService } from "./world-api-proxy.service";

@Module({
  // CloudClientAuthGuard 自带 @InjectRepository(CloudUserEntity)，guard 实例
  // 在该 controller 所在 module scope 实例化，所以这里也得 forFeature 一份
  // 让 typeorm 注入器能解析；CloudWorld/CloudInstance 是 service 自己用的。
  imports: [
    TypeOrmModule.forFeature([
      CloudWorldEntity,
      CloudInstanceEntity,
      CloudUserEntity,
    ]),
  ],
  controllers: [WorldApiProxyController],
  providers: [WorldApiProxyService],
  exports: [WorldApiProxyService],
})
export class WorldApiProxyModule {}
