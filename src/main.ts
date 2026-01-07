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
  origin: '*',
  credentials: true,
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

const port = process.env.PORT || 5000;
await app.listen(port);

  console.log('🚀 Application is running on:');
  console.log('   - Local:   http://localhost:5000');
  console.log('   - Network: http://10.19.144.5:5000');
  console.log('📚 Swagger docs: http://localhost:5000/api');
  console.log('🌐 Web Frontend: http://localhost:3000');
  console.log('📱 Mobile: 10.0.2.2:5000 (emulator) or 10.19.144.5:5000 (device)');
}
bootstrap();