import { ParsedEndpoint, ParsedSpec } from './parser';

/**
 * Generates a TypeScript API client file from a parsed OpenAPI specification.
 * The output is a standalone TypeScript module that can be imported into project configs or test files.
 */
export function generateApiFile(spec: ParsedSpec, opts?: { importFrom?: string }): string {
    const importFrom = opts?.importFrom || '@htplus/k6-lib';
    const grouped = groupByTag(spec.endpoints);

    const header = `/* eslint-disable */
/**
 * AUTO-GENERATED — DO NOT EDIT.
 * Source: ${spec.title} v${spec.version}
 * Generator: @htplus/k6-lib openapi codegen
 */
import { RestClient, CallOptions, TypedResponse } from '${importFrom}';

`;

    const typeDefs = renderTypeDefs(spec.types);

    const namespaces = Object.keys(grouped).map((tag) => {
        return renderNamespace(tag, grouped[tag]);
    }).join('\n\n');

    const factory = `
export interface GeneratedApi {
${Object.keys(grouped).map((tag) => `    ${camelCase(tag)}: ${pascalCase(tag)}Api;`).join('\n')}
}

export function createApi(client: RestClient): GeneratedApi {
    return {
${Object.keys(grouped).map((tag) => `        ${camelCase(tag)}: create${pascalCase(tag)}Api(client),`).join('\n')}
    };
}
`;

    return header + typeDefs + '\n\n' + namespaces + '\n\n' + factory;
}

function groupByTag(endpoints: ParsedEndpoint[]): Record<string, ParsedEndpoint[]> {
    const out: Record<string, ParsedEndpoint[]> = {};
    endpoints.forEach((e) => {
        if (!out[e.tag]) out[e.tag] = [];
        out[e.tag].push(e);
    });
    return out;
}

function renderTypeDefs(types: Record<string, string>): string {
    return Object.keys(types).map((name) => {
        const t = types[name];
        return `export type ${name} = ${t};`;
    }).join('\n\n');
}

function renderNamespace(tag: string, endpoints: ParsedEndpoint[]): string {
    const interfaceName = `${pascalCase(tag)}Api`;
    const factoryName = `create${pascalCase(tag)}Api`;

    const methods = endpoints.map(renderMethodSignature).join('\n');
    const impls = endpoints.map(renderMethodImpl).join('\n\n');

    return `export interface ${interfaceName} {
${methods}
}

export function ${factoryName}(client: RestClient): ${interfaceName} {
    return {
${impls}
    };
}`;
}

function renderMethodSignature(e: ParsedEndpoint): string {
    const args = buildArgList(e, /* signatureOnly */ true);
    const returnT = `TypedResponse<${e.responseTypeName || 'unknown'}>`;
    return `    ${methodName(e)}: (${args}) => ${returnT};`;
}

function renderMethodImpl(e: ParsedEndpoint): string {
    const args = buildArgList(e, false);
    const httpMethod = methodCall(e.method);
    const pathExpr = renderPathExpr(e);
    const queryExpr = e.queryParams.length ? 'query' : 'undefined';
    const callOptsExpr = `{ ...(opts || {}), params: { ...(opts?.params || {}), ${queryExpr === 'query' ? '...query' : ''} } }`;
    const bodyArg = e.requestBodyTypeName ? ', body' : (needsBody(e.method) ? ', undefined' : '');

    return `        ${methodName(e)}: (${args}) => {
            return client.${httpMethod}(${pathExpr}${bodyArg}, ${callOptsExpr});
        },`;
}

function buildArgList(e: ParsedEndpoint, _signatureOnly: boolean): string {
    const parts: string[] = [];
    e.pathParams.forEach((p) => parts.push(`${p.name}: ${p.type}`));
    if (e.queryParams.length) {
        const allOpt = e.queryParams.every((p) => !p.required);
        const inner = e.queryParams.map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join('; ');
        parts.push(`query${allOpt ? '?' : ''}: { ${inner} }`);
    }
    if (e.requestBodyTypeName) {
        parts.push(`body: ${e.requestBodyTypeName}`);
    }
    parts.push(`opts?: CallOptions`);
    return parts.join(', ');
}

function renderPathExpr(e: ParsedEndpoint): string {
    if (!e.pathParams.length) return `'${e.path}'`;
    let p = e.path;
    e.pathParams.forEach((pp) => {
        p = p.replace(`{${pp.name}}`, `\${${pp.name}}`);
    });
    return `\`${p}\``;
}

function methodName(e: ParsedEndpoint): string {
    return camelCase(e.operationId);
}

function methodCall(m: ParsedEndpoint['method']): string {
    if (m === 'delete') return 'del';
    return m;
}

function needsBody(m: ParsedEndpoint['method']): boolean {
    return m === 'post' || m === 'put' || m === 'patch' || m === 'delete';
}

function camelCase(s: string): string {
    return s.replace(/[_\-\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (m) => m.toLowerCase());
}

function pascalCase(s: string): string {
    const c = camelCase(s);
    return c.charAt(0).toUpperCase() + c.slice(1);
}
