/**
 * OpenAPI 3.x / Swagger 2.x parser — runs at build time (Node).
 * Do not import any k6 module here.
 */

/** A single endpoint parsed from the OpenAPI spec, ready for code generation. */
export interface ParsedEndpoint {
    operationId: string;
    method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
    path: string;
    /** Primary tag used to group endpoints into namespaces, e.g. 'posts', 'users'. */
    tag: string;
    pathParams: ParsedParam[];
    queryParams: ParsedParam[];
    headerParams: ParsedParam[];
    requestBodyTypeName?: string;
    responseTypeName?: string;
    summary?: string;
}

/** A parsed parameter (path, query, or header) from an OpenAPI operation. */
export interface ParsedParam {
    name: string;
    required: boolean;
    type: string; // TS type literal
}

/** The result of parsing an OpenAPI specification, containing all endpoints and type definitions. */
export interface ParsedSpec {
    title: string;
    version: string;
    endpoints: ParsedEndpoint[];
    /** Maps schema names to TypeScript type definition strings. */
    types: Record<string, string>;
}

interface OASRoot {
    openapi?: string;
    swagger?: string;
    info?: { title?: string; version?: string };
    paths?: Record<string, Record<string, OASOperation>>;
    components?: { schemas?: Record<string, OASSchema> };
    definitions?: Record<string, OASSchema>;
}

interface OASOperation {
    operationId?: string;
    tags?: string[];
    summary?: string;
    parameters?: OASParam[];
    requestBody?: { content?: Record<string, { schema?: OASSchema }>; required?: boolean };
    responses?: Record<string, { content?: Record<string, { schema?: OASSchema }>; schema?: OASSchema }>;
}

interface OASParam {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    schema?: OASSchema;
    type?: string;
}

interface OASSchema {
    type?: string;
    format?: string;
    items?: OASSchema;
    properties?: Record<string, OASSchema>;
    required?: string[];
    $ref?: string;
    enum?: unknown[];
    oneOf?: OASSchema[];
    anyOf?: OASSchema[];
    allOf?: OASSchema[];
    additionalProperties?: boolean | OASSchema;
    description?: string;
}

/**
 * Parses a raw OpenAPI 3.x or Swagger 2.x root object into a normalized ParsedSpec.
 * Extracts endpoints, parameters, request bodies, response types, and named schemas.
 */
export function parseSpec(spec: OASRoot): ParsedSpec {
    const endpoints: ParsedEndpoint[] = [];
    const types: Record<string, string> = {};

    const schemaMap = spec.components?.schemas || spec.definitions || {};
    Object.keys(schemaMap).forEach((name) => {
        types[name] = renderType(schemaMap[name], schemaMap);
    });

    const paths = spec.paths || {};
    Object.keys(paths).forEach((p) => {
        const pathItem = paths[p];
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].forEach((m) => {
            const op = (pathItem as Record<string, OASOperation>)[m];
            if (!op) return;

            const tag = (op.tags && op.tags[0]) || 'default';
            const operationId = op.operationId || autoOperationId(m, p);
            const params = op.parameters || [];
            const pathParams = params.filter((x) => x.in === 'path').map((x) => toParam(x, schemaMap));
            const queryParams = params.filter((x) => x.in === 'query').map((x) => toParam(x, schemaMap));
            const headerParams = params.filter((x) => x.in === 'header').map((x) => toParam(x, schemaMap));

            const bodySchema = op.requestBody?.content?.['application/json']?.schema;
            const requestBodyTypeName = bodySchema ? renderType(bodySchema, schemaMap) : undefined;

            const okResp = op.responses?.['200'] || op.responses?.['201'] || op.responses?.['default'];
            const respSchema = okResp?.content?.['application/json']?.schema || okResp?.schema;
            const responseTypeName = respSchema ? renderType(respSchema, schemaMap) : 'unknown';

            endpoints.push({
                operationId,
                method: m as ParsedEndpoint['method'],
                path: p,
                tag,
                pathParams,
                queryParams,
                headerParams,
                requestBodyTypeName,
                responseTypeName,
                summary: op.summary,
            });
        });
    });

    return {
        title: spec.info?.title || 'API',
        version: spec.info?.version || '1.0.0',
        endpoints,
        types,
    };
}

function toParam(p: OASParam, schemas: Record<string, OASSchema>): ParsedParam {
    return {
        name: p.name,
        required: p.required === true || p.in === 'path',
        type: p.schema ? renderType(p.schema, schemas) : (p.type ? oasTypeToTs(p.type) : 'string'),
    };
}

function renderType(schema: OASSchema, schemas: Record<string, OASSchema>, depth = 0): string {
    if (depth > 8) return 'unknown';
    if (!schema) return 'unknown';
    if (schema.$ref) {
        const name = schema.$ref.split('/').pop() || 'unknown';
        return name;
    }
    if (schema.enum && schema.enum.length) {
        return schema.enum.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(' | ');
    }
    if (schema.allOf || schema.oneOf || schema.anyOf) {
        const arr = schema.allOf || schema.oneOf || schema.anyOf || [];
        const joiner = schema.allOf ? ' & ' : ' | ';
        return arr.map((s) => renderType(s, schemas, depth + 1)).join(joiner) || 'unknown';
    }
    if (schema.type === 'array') {
        return `Array<${schema.items ? renderType(schema.items, schemas, depth + 1) : 'unknown'}>`;
    }
    if (schema.type === 'object' || schema.properties) {
        const props = schema.properties || {};
        const required = new Set(schema.required || []);
        const inner = Object.keys(props).map((k) => {
            const opt = required.has(k) ? '' : '?';
            return `  ${escapeKey(k)}${opt}: ${renderType(props[k], schemas, depth + 1)};`;
        }).join('\n');
        return `{\n${inner}\n}`;
    }
    return oasTypeToTs(schema.type || 'string');
}

function escapeKey(k: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k}'`;
}

function oasTypeToTs(t: string): string {
    switch (t) {
        case 'integer':
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'string':
            return 'string';
        case 'object':
            return 'Record<string, unknown>';
        case 'array':
            return 'Array<unknown>';
        default:
            return 'unknown';
    }
}

function autoOperationId(method: string, path: string): string {
    const seg = path.replace(/\{([^}]+)\}/g, 'By_$1').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `${method}_${seg}`.replace(/_+/g, '_');
}
