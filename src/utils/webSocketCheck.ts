/**
 * This utility helps prevent WebSocket connection errors to external servers
 * that may be referenced by dependencies but aren't actually needed.
 * 
 * It specifically addresses the error: "WebSocket connection to 'wss://rumahkita.rnggagib.me:3000/ws' failed"
 * 
 * How it works:
 * 1. WebRTC libraries often attempt to set up their own signaling servers
 * 2. We intercept these connections and provide a mock WebSocket implementation
 * 3. This prevents connection errors in the console and potential hanging operations
 * 4. Our Firebase-based signaling works independently of these WebSocket connections
 */

// List of problematic WebSocket URLs to intercept
const BLOCKED_WS_PATTERNS = [
  'rumahkita.rnggagib.me:3000',
  'rumahkita.rnggagib.me', // Broader pattern
  'rnggagib.me',           // Even broader pattern
  'wss://rumahkita',       // Catch variations of the URL
  'ws://rumahkita',        // Catch non-secure versions too
];

// Counter to track blocked connections for logging
let blockedConnectionCount = 0;

/**
 * Checks if a WebSocket URL should be blocked
 */
const shouldBlockWebSocketUrl = (url: string): boolean => {
  // Case insensitive check for more robust matching
  const lowerUrl = url.toLowerCase();
  
  // More efficient detection algorithm
  const shouldBlock = BLOCKED_WS_PATTERNS.some(pattern => lowerUrl.includes(pattern.toLowerCase()));
  
  // Improved logging with distinctions between different blocked URLs
  if (shouldBlock) {
    blockedConnectionCount++;
    
    // Only log every few connections to prevent console spam
    // This helps identify patterns of excessive connection attempts
    if (blockedConnectionCount <= 5 || blockedConnectionCount % 10 === 0) {
      console.log(`WebSocketCheck: Blocked connection #${blockedConnectionCount} to ${url}`);
      
      // Add explanation for why this is happening
      if (blockedConnectionCount === 5) {
        console.info(
          '%cWebSocket connections to external signaling servers are being blocked intentionally. ' +
          'This is normal and prevents unnecessary errors in the console.',
          'color: #2196F3; font-weight: bold;'
        );
      }
      
      // Alert about potential room creation loop at a higher threshold
      if (blockedConnectionCount >= 20) {
        console.warn(
          'Detected unusually high number of WebSocket connection attempts. ' +
          'This may indicate a loop in WebRTC room creation. Consider refreshing the page.'
        );
      }
    }
  }
  
  return shouldBlock;
};

/**
 * Creates a mock WebSocket that can be used as a replacement
 */
class MockWebSocket extends EventTarget implements WebSocket {
  // Static constants for WebSocket states
  static readonly CONNECTING: number = 0;
  static readonly OPEN: number = 1;
  static readonly CLOSING: number = 2;
  static readonly CLOSED: number = 3;
    // Instance properties that satisfy the WebSocket interface requirements
  // Using literal types as required by the WebSocket interface
  readonly CONNECTING: 0 = 0;
  readonly OPEN: 1 = 1;
  readonly CLOSING: 2 = 2;
  readonly CLOSED: 3 = 3;
  
  // Instance properties required by WebSocket interface
  readonly url: string;
  readonly protocol: string;
  readyState: number;
  bufferedAmount: number;
  readonly extensions: string;
  binaryType: BinaryType;
  
  onopen: ((ev: Event) => any) | null = null;
  onmessage: ((ev: MessageEvent) => any) | null = null;
  onerror: ((ev: Event) => any) | null = null;
  onclose: ((ev: CloseEvent) => any) | null = null;
  constructor(url: string, protocols?: string | string[]) {
    super();
    
    // Initialize all required properties in the constructor
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols.join(', ') : (protocols || '');
    this.readyState = MockWebSocket.CONNECTING; // Initially connecting
    this.bufferedAmount = 0;
    this.extensions = '';
    this.binaryType = 'blob';
    
    // Simulate a realistic connection lifecycle
    
    // Step 1: Connection attempt (very short delay to simulate network activity)
    setTimeout(() => {
      // Step 2: Connection failed - first dispatch an error
      const errorEvent = new ErrorEvent('error', { 
        message: 'Connection intercepted by application',
        error: new Error('Connection to blocked WebSocket URL was intentionally intercepted') 
      });
      
      if (this.onerror) {
        const handler = this.onerror;
        handler(errorEvent);
      }
      
      this.dispatchEvent(errorEvent);
      
      // Step 3: Then close the connection with a normal close code
      const closeEvent = new CloseEvent('close', { 
        wasClean: true, 
        code: 1000, 
        reason: 'Connection intercepted by application' 
      });
      
      // Update readyState before dispatching the close event
      this.readyState = MockWebSocket.CLOSED;
      
      if (this.onclose) {
        const handler = this.onclose;
        handler(closeEvent);
      }
      
      this.dispatchEvent(closeEvent);
    }, 50);
  }
  
  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    // Do nothing - this is a mock
  }
  
  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }
  
  // Required method from WebSocket interface
  addEventListener<K extends keyof WebSocketEventMap>(
    type: K, 
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, 
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string, 
    listener: EventListenerOrEventListenerObject, 
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener as EventListener, options);
  }
  
  removeEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener as EventListener, options);
  }
  
  dispatchEvent(event: Event): boolean {
    return super.dispatchEvent(event);
  }
}

/**
 * Intercepts WebSocket connections and blocks ones that match the specified pattern
 */
export const setupWebSocketInterceptor = (): void => {
  try {
    // Store the original WebSocket constructor
    const OriginalWebSocket = window.WebSocket;
      // Create a function to replace the WebSocket constructor
    const WebSocketInterceptor = function(
      this: any, 
      url: string | URL, 
      protocols?: string | string[]
    ) {
      const urlString = url.toString();
      
      // Check if the URL matches any of the problematic patterns
      if (shouldBlockWebSocketUrl(urlString)) {
        console.warn(
          `WebSocket connection to ${urlString} was intercepted to prevent errors. ` +
          `This connection isn't needed for the application's functionality.`
        );
        
        // Create our mock WebSocket instead
        return new MockWebSocket(urlString, protocols);
      } else {
        // For all other WebSocket connections, proceed normally
        // We need to use the constructor in this way to maintain proper inheritance
        return new OriginalWebSocket(url, protocols);
      }
    };
    
    // Cast our interceptor to the WebSocket constructor type
    const interceptWebSocket = WebSocketInterceptor as unknown as typeof WebSocket;
      // Copy over static properties from original WebSocket using Object.defineProperty
    // This avoids TypeScript errors when assigning to readonly properties
    Object.defineProperty(interceptWebSocket, 'CONNECTING', { value: OriginalWebSocket.CONNECTING });
    Object.defineProperty(interceptWebSocket, 'OPEN', { value: OriginalWebSocket.OPEN });
    Object.defineProperty(interceptWebSocket, 'CLOSING', { value: OriginalWebSocket.CLOSING });
    Object.defineProperty(interceptWebSocket, 'CLOSED', { value: OriginalWebSocket.CLOSED });
    
    // Set the prototype to maintain inheritance
    interceptWebSocket.prototype = OriginalWebSocket.prototype;
      // Replace the global WebSocket constructor with our intercepted one
    window.WebSocket = interceptWebSocket;
    
    console.log('%cWebSocket interceptor has been set up to prevent unnecessary connection errors', 
                'background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px;');
    console.log(`Blocking WebSocket connections to: ${BLOCKED_WS_PATTERNS.join(', ')}`);
  } catch (error) {
    console.error('Failed to set up WebSocket interceptor:', error);
    // Don't break the application if our interceptor fails
  }
};
