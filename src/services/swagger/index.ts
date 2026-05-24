import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


const options = new DocumentBuilder()
  .setTitle('Sbzee Pro')
  .setDescription('API descriptions for the Sbzee.')
  .setVersion('1.0.0-alpha-3')
  .addBasicAuth()
  .addBearerAuth()
  .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'master-key')
  .addApiKey(
    { type: 'apiKey', name: 'x-api-public-key', in: 'header' },
    'x-api-public-key',
  )
  .addApiKey(
    { type: 'apiKey', name: 'x-api-secret-key', in: 'header' },
    'x-api-secret-key',
  )
  .build();

const selectedConfig = new DocumentBuilder()
  .setTitle('Selected API')
  .setDescription('Only selected endpoints')
  .setVersion('1.0')
  .build();

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

// Swagger UI only sends an apiKey header when the operation's own `security`
// array references that scheme.  Document-level security is not reliably
// honoured by all Swagger UI versions.  We therefore inject the API-key pair
// requirement directly into every generated operation so the headers are
// always included when the user fills them in the Authorize dialog.
function injectApiKeySecurityIntoAllOperations(document: Record<string, any>) {
  const apiKeySecurity = { 'x-api-public-key': [], 'x-api-secret-key': [] };

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as any)[method];
      if (operation && typeof operation === 'object') {
        operation.security = [...(operation.security ?? []), apiKeySecurity];
      }
    }
  }
}

export const createSwagger = (app: NestExpressApplication) => {
  const document = SwaggerModule.createDocument(app, options);

  injectApiKeySecurityIntoAllOperations(document);

  SwaggerModule.setup('/api/docs', app, document);

  // Pass an array of modules or controllers to limit the docs
//   const selectedDocument = SwaggerModule.createDocument(app, selectedConfig, {
//     include: [OrganizationModule], // Only this controller
//   });

//   const allowedPaths = [
//     '/api/v1/organization/pharmacies-transmissions-insights',
//   ];

//   selectedDocument.paths = Object.fromEntries(
//     Object.entries(selectedDocument.paths).filter(([path]) => {
//       // console.log(path, '>>>>');
//       return allowedPaths.includes(path);
//     }),
//   );

  SwaggerModule.setup('selected-api', app, document);
};
