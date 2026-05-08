import { randomUUID } from "node:crypto";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppModule } from "./app.module";
import { CloudApiExceptionFilter } from "./i18n/cloud-api-exception.filter";

const WORLD_API_PROXY_PATH_REGEX = /^\/cloud\/world-api(\/|$|\?)/;

// world-api 反代路径要把 raw stream pipe 给 child process，express.json 把
// body 解析成对象后 IncomingMessage 就读不出来了；这里把 body parser 包一层，
// 让反代路径直接跳过解析，其他路径行为不变。
function skipBodyParserForProxy(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (WORLD_API_PROXY_PATH_REGEX.test(req.url)) {
      return next();
    }
    return handler(req, res, next);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(skipBodyParserForProxy(express.json({ limit: "32mb" })));
  app.use(
    skipBodyParserForProxy(
      express.urlencoded({ extended: true, limit: "32mb" }),
    ),
  );
  app.use((request, response, next) => {
    const incomingRequestId =
      typeof request.header === "function"
        ? request.header("X-Request-Id")?.trim()
        : "";
    const requestId = incomingRequestId || randomUUID();
    response.setHeader("X-Request-Id", requestId);
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );
  app.useGlobalFilters(new CloudApiExceptionFilter());
  app.enableCors({
    origin: true,
    credentials: false,
    exposedHeaders: ["X-Request-Id"],
  });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}

void bootstrap();
