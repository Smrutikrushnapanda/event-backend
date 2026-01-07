import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  home() {
    return {
      status: 'ok',
      message: 'NestJS backend running on port 5000',
    };
  }
}
