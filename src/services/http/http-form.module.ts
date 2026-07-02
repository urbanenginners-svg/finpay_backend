import { Global, Module } from '@nestjs/common';

import { HttpFormService } from './http-form.service';

@Global()
@Module({
  providers: [HttpFormService],
  exports: [HttpFormService],
})
export class HttpFormModule {}
