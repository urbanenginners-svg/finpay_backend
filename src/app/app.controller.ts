import {  Controller, Get } from '@nestjs/common';
import { ApiTags} from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from 'src/utils/decorators/public-key.decorator';

@Controller()
@ApiTags('Health Check')
export class AppController {
    constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getRoot(): { message: string; status: string; apiDocs: string } {
    return {
      message: 'API is running testing the docs',
      status: 'ok',
      apiDocs: '/api/docs',
    };
  }

  @Get('hello')
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

}