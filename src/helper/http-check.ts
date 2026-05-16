import { K6Response } from '../types/common';

/** Checks if the response status is HTTP 200 OK. */
export function isStatus200(response: K6Response): boolean {
    return response?.status === 200;
}

/** Checks if the response status is HTTP 201 Created. */
export function isStatus201(response: K6Response): boolean {
    return response?.status === 201;
}

/** Checks if the response status is HTTP 204 No Content. */
export function isStatus204(response: K6Response): boolean {
    return response?.status === 204;
}

/** Checks if the response status is HTTP 400 Bad Request. */
export function isStatus400(response: K6Response): boolean {
    return response?.status === 400;
}

/** Checks if the response status is HTTP 401 Unauthorized. */
export function isStatus401(response: K6Response): boolean {
    return response?.status === 401;
}

/** Checks if the response status is HTTP 403 Forbidden. */
export function isStatus403(response: K6Response): boolean {
    return response?.status === 403;
}

/** Checks if the response status is HTTP 404 Not Found. */
export function isStatus404(response: K6Response): boolean {
    return response?.status === 404;
}

/** Checks if the response status is HTTP 409 Conflict. */
export function isStatus409(response: K6Response): boolean {
    return response?.status === 409;
}

/** Checks if the response status is HTTP 422 Unprocessable Entity. */
export function isStatus422(response: K6Response): boolean {
    return response?.status === 422;
}

/** Checks if the response status is HTTP 500 Internal Server Error. */
export function isStatus500(response: K6Response): boolean {
    return response?.status === 500;
}

/** Checks if the response status is a success (2xx range). */
export function isSuccess(response: K6Response): boolean {
    const status = response?.status ?? 0;
    return status >= 200 && status < 300;
}

/** Checks if the response status is a client error (4xx range). */
export function isClientError(response: K6Response): boolean {
    const status = response?.status ?? 0;
    return status >= 400 && status < 500;
}

/** Checks if the response status is a server error (5xx range). */
export function isServerError(response: K6Response): boolean {
    const status = response?.status ?? 0;
    return status >= 500 && status < 600;
}

/** Checks if the response was delivered over HTTPS or HTTP/2. */
export function isHTTPS(response: K6Response): boolean {
    return (response?.proto === "HTTP/2.0") || (response?.url?.startsWith('https://') ?? false);
}

/** Checks if the response Content-Type header indicates JSON. */
export function hasJSONBody(response: K6Response): boolean {
    try {
        const contentType = response?.headers?.['Content-Type'] || response?.headers?.['content-type'] || '';
        return contentType.includes('application/json');
    } catch {
        return false;
    }
}

/** Checks if the response duration is below the specified threshold in milliseconds. */
export function isResponseTimeAcceptable(response: K6Response, maxMs: number): boolean {
    const duration = response?.timings?.duration || 0;
    return duration < maxMs;
}

