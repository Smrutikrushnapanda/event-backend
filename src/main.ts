import { NestFactory } from '@nestjs/core'; // ✅ Correct
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Allow multiple origins: Web + Mobile
  app.enableCors({
    origin: [
      'http://localhost:3000',           // Next.js web frontend
      'http://10.19.144.5:3000',        // Web from network
      'http://10.0.2.2:5000',           // Android emulator
      'http://localhost:8081',          // React Native Metro bundler
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  // Swagger Config
  const config = new DocumentBuilder()
    .setTitle('Event Registration API')
    .setDescription('API for Event Registration & Check-ins')
    .setVersion('1.0')
    .addTag('Registrations', 'Event registration and check-in endpoints')
    .addTag('Volunteers', 'Volunteer registration endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ✅ Listen on all network interfaces
  await app.listen(5000, '0.0.0.0');

  console.log('🚀 Application is running on:');
  console.log('   - Local:   http://localhost:5000');
  console.log('   - Network: http://10.19.144.5:5000');
  console.log('📚 Swagger docs: http://localhost:5000/api');
  console.log('🌐 Web Frontend: http://localhost:3000');
  console.log('📱 Mobile: 10.0.2.2:5000 (emulator) or 10.19.144.5:5000 (device)');
}
bootstrap();