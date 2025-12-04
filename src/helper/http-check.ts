import { K6Response } from '../types/common';

export function isStatus200(response: K6Response): boolean {
    return response?.status === 200;
}

export function isStatus201(response: K6Response): boolean {
    return response?.status === 201;
}

export function isStatus204(response: K6Response): boolean {
    return response?.status === 204;
}

export function isStatus400(response: K6Response): boolean {
    return response?.status === 400;
}

export function isStatus401(response: K6Response): boolean {
    return response?.status === 401;
}

export function isStatus403(response: K6Response): boolean {
    return response?.status === 403;
}

export function isStatus404(response: K6Response): boolean {
    return response?.status === 404;
}

export function isStatus409(response: K6Response): boolean {
    return response?.status === 409;
}

export function isStatus422(response: K6Response): boolean {
    return response?.status === 422;
}

export function isStatus500(response: K6Response): boolean {
    return response?.status === 500;
}

export function isSuccess(response: K6Response): boolean {
    const status = response?.status ?? 0;
    return status >= 200 && status < 300;
}

export function isClientError(response: K6Response): boolean {
    const status = response?.status ?? 0;
    return status >= 400 && status < 500;
}

export function isServerError(response: K6Response): boolean {
    const status = response?.status ?? 0;
    return status >= 500 && status < 600;
}

export function isHTTPS(response: K6Response): boolean {
    return (response?.proto === "HTTP/2.0") || (response?.url?.startsWith('https://') ?? false);
}

export function hasJSONBody(response: K6Response): boolean {
    try {
        const contentType = response?.headers?.['Content-Type'] || response?.headers?.['content-type'] || '';
        return contentType.includes('application/json');
    } catch {
        return false;
    }
}

export function isResponseTimeAcceptable(response: K6Response, maxMs: number): boolean {
    const duration = response?.timings?.duration || 0;
    return duration < maxMs;
}

