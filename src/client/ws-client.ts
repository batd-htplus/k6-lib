import ws, { Socket } from 'k6/ws';
import { Trend, Counter, Rate } from 'k6/metrics';

/** Determines how the WebSocket token is attached to the connection. */
export type WsAuthMode = 'header' | 'query' | 'first-message' | 'none';

/** Options for opening a single WebSocket connection. */
export interface WsConnectOptions {
    /** Auth provider name in the registry (if configured). */
    auth?: string | false;
    /** Raw token to use instead of resolving from the auth registry. */
    token?: string;
    /** Additional query parameters to include in the connection URL. */
    query?: Record<string, string | number | boolean>;
    /** Additional headers to include in the connection request. */
    headers?: Record<string, string>;
    /** Custom k6 tags for WebSocket metrics. */
    tags?: Record<string, string>;
}

/** Configuration for creating a WsClient instance. */
export interface WsClientConfig {
    /** Base URL for WebSocket connections (ws:// or wss://). */
    baseURL: string;
    /** Default WebSocket path, e.g. '/ws'. */
    path?: string;
    /** How the token is attached to the connection. */
    authMode?: WsAuthMode;
    /** Query parameter name when authMode is 'query'. Defaults to 'token'. */
    queryName?: string;
    /** Header name when authMode is 'header'. Defaults to 'Authorization'. */
    headerName?: string;
    /** Header value format when authMode is 'header'. Defaults to 'Bearer {token}'. */
    headerFormat?: string;
    /** Function that builds the first message payload when authMode is 'first-message'. */
    authMessage?: (token: string) => unknown;
    /** Default tags attached to every WebSocket metric. */
    defaultTags?: Record<string, string>;
}

/** Looks up authentication tokens for WebSocket connections. */
export interface WsAuthApplier {
    getToken: (authName: string) => string | null;
}

/** Wrapper around a raw k6/ws Socket with convenience helpers and automatic metrics tracking. */
export interface WrappedSocket {
    /** The underlying k6/ws Socket instance. */
    raw: Socket;
    /** Sends a raw string message over the socket. */
    send: (data: string) => void;
    /** Serializes an object to JSON and sends it with an auto-generated __id for RTT tracking. */
    sendJSON: (obj: unknown) => void;
    /** Registers a handler for the 'open' event. */
    onOpen: (handler: () => void) => void;
    /** Registers a handler for incoming text messages. */
    onMessage: (handler: (msg: string) => void) => void;
    /** Registers a handler that receives parsed JSON messages with automatic RTT measurement. */
    onJSON: <T = unknown>(handler: (data: T) => void) => void;
    /** Registers a handler for the 'close' event. */
    onClose: (handler: () => void) => void;
    /** Registers a handler for the 'error' event. */
    onError: (handler: (err: unknown) => void) => void;
    /** Sends a message at a fixed interval. Accepts a duration string (e.g. '5s'). */
    sendEvery: (interval: string, fn: () => unknown) => void;
    /** Keeps the connection open for the given duration then closes it. */
    waitFor: (duration: string) => void;
    /** Closes the WebSocket connection. */
    close: () => void;
}

/** WebSocket client built on top of k6/ws with auth, metrics, and convenience wrappers. */
export class WsClient {
    protected baseURL: string;
    protected config: WsClientConfig;
    protected authApplier?: WsAuthApplier;

    protected connectTrend: Trend;
    protected rttTrend: Trend;
    protected msgSent: Counter;
    protected msgReceived: Counter;
    protected errorRate: Rate;

    /**
     * @param config - Client configuration including base URL, auth mode, and default tags.
     */
    constructor(config: WsClientConfig) {
        this.baseURL = this.toWsUrl(config.baseURL);
        this.config = {
            authMode: 'query',
            queryName: 'token',
            headerName: 'Authorization',
            headerFormat: 'Bearer {token}',
            ...config,
        };
        this.connectTrend = new Trend('ws_connect_ms', true);
        this.rttTrend = new Trend('ws_msg_rtt_ms', true);
        this.msgSent = new Counter('ws_msg_sent');
        this.msgReceived = new Counter('ws_msg_received');
        this.errorRate = new Rate('ws_errors');
    }

    /**
     * Registers an auth applier responsible for resolving authentication tokens.
     * Typically injected by the project definition layer.
     */
    setAuthApplier(applier: WsAuthApplier): void {
        this.authApplier = applier;
    }

    /**
     * Opens a WebSocket connection and invokes the handler with a wrapped socket.
     * Supports token-based auth via header, query parameter, or first message.
     * Automatically tracks connect duration, RTT, message counts, and errors.
     *
     * @param path - WebSocket path (overrides the default path from config).
     * @param opts - Connection options including auth, headers, query params, and tags.
     * @param handler - Callback invoked with the WrappedSocket once connected.
     */
    connect(path: string | undefined, opts: WsConnectOptions, handler: (socket: WrappedSocket) => void): void {
        const finalPath = path || this.config.path || '/';
        const token = this.resolveToken(opts);

        let url = this.baseURL.replace(/\/+$/, '') + (finalPath.startsWith('/') ? finalPath : `/${finalPath}`);
        const headers: Record<string, string> = { ...(opts.headers || {}) };
        const query: Record<string, string | number | boolean> = { ...(opts.query || {}) };

        if (token) {
            switch (this.config.authMode) {
                case 'header':
                    headers[this.config.headerName!] = (this.config.headerFormat || 'Bearer {token}').replace('{token}', token);
                    break;
                case 'query':
                    query[this.config.queryName!] = token;
                    break;
                case 'first-message':
                case 'none':
                    break;
            }
        }

        const qs = Object.keys(query)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
            .join('&');
        if (qs) url += (url.includes('?') ? '&' : '?') + qs;

        const tags = { ...(this.config.defaultTags || {}), ...(opts.tags || {}) };
        const connectStart = Date.now();

        const response = ws.connect(url, { headers, tags }, (socket) => {
            this.connectTrend.add(Date.now() - connectStart);

            const sentTimestamps: Record<string, number> = {};
            let seq = 0;

            const wrapped: WrappedSocket = {
                raw: socket,
                send: (data: string) => {
                    this.msgSent.add(1);
                    socket.send(data);
                },
                sendJSON: (obj: unknown) => {
                    const id = `m${++seq}`;
                    sentTimestamps[id] = Date.now();
                    const payload = JSON.stringify({ __id: id, ...(obj as Record<string, unknown>) });
                    this.msgSent.add(1);
                    socket.send(payload);
                },
                onOpen: (h) => socket.on('open', h),
                onMessage: (h) => socket.on('message', (msg: string) => {
                    this.msgReceived.add(1);
                    h(msg);
                }),
                onJSON: <T = unknown>(h: (data: T) => void) => socket.on('message', (msg: string) => {
                    this.msgReceived.add(1);
                    try {
                        const data = JSON.parse(msg) as { __id?: string } & T;
                        if (data.__id && sentTimestamps[data.__id]) {
                            this.rttTrend.add(Date.now() - sentTimestamps[data.__id]);
                            delete sentTimestamps[data.__id];
                        }
                        h(data as T);
                    } catch {
                        this.errorRate.add(true);
                    }
                }),
                onClose: (h) => socket.on('close', h),
                onError: (h) => socket.on('error', (e) => {
                    this.errorRate.add(true);
                    h(e);
                }),
                sendEvery: (interval, fn) => {
                    const ms = this.parseDuration(interval);
                    socket.setInterval(() => {
                        const obj = fn();
                        if (typeof obj === 'string') wrapped.send(obj);
                        else wrapped.sendJSON(obj);
                    }, ms);
                },
                waitFor: (duration) => {
                    const ms = this.parseDuration(duration);
                    socket.setTimeout(() => socket.close(), ms);
                },
                close: () => socket.close(),
            };

            // Auth via first message after opening the connection.
            if (this.config.authMode === 'first-message' && token && this.config.authMessage) {
                socket.on('open', () => {
                    const msg = this.config.authMessage!(token);
                    socket.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
                });
            }

            handler(wrapped);
        });

        if (response && response.status !== 101) {
            this.errorRate.add(true);
        }
    }

    /** Resolves the authentication token from options or the registered auth applier. */
    protected resolveToken(opts: WsConnectOptions): string | null {
        if (opts.token) return opts.token;
        if (opts.auth === false) return null;
        if (this.authApplier) {
            return this.authApplier.getToken((opts.auth as string) || 'default');
        }
        return null;
    }

    /** Converts an HTTP/HTTPS URL to a WebSocket WS/WSS URL. */
    protected toWsUrl(baseURL: string): string {
        if (!baseURL) return '';
        if (baseURL.startsWith('ws://') || baseURL.startsWith('wss://')) return baseURL;
        if (baseURL.startsWith('https://')) return 'wss://' + baseURL.substring('https://'.length);
        if (baseURL.startsWith('http://')) return 'ws://' + baseURL.substring('http://'.length);
        return 'ws://' + baseURL;
    }

    /** Parses a duration string (e.g. '30s', '500ms', '2m') into milliseconds. */
    protected parseDuration(s: string): number {
        const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(s.trim());
        if (!m) return Number(s) || 0;
        const n = parseFloat(m[1]);
        switch (m[2]) {
            case 'ms': return n;
            case 's':
            case undefined:
                return n * 1000;
            case 'm': return n * 60 * 1000;
            case 'h': return n * 3600 * 1000;
            default: return n;
        }
    }
}
