import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'public'),
      serveRoot: '/api/static',
      serveStaticOptions: {
        cacheControl: true,
        maxAge: '1d',
      },
    })
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
