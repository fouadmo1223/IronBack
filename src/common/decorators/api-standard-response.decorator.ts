import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/** Documents the standard success envelope with a typed `data` payload in Swagger. */
export function ApiStandardResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: { isArray?: boolean; paginated?: boolean } = {},
) {
  const dataSchema = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: dataSchema,
          ...(options.paginated
            ? {
                meta: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 20 },
                    total: { type: 'number', example: 500 },
                    pages: { type: 'number', example: 25 },
                  },
                },
              }
            : {}),
        },
      },
    }),
  );
}
