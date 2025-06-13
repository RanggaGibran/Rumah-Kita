/**
 * WebRTC Diagnostics Utility
 * 
 * This module provides diagnostic functions to help troubleshoot WebRTC connection issues
 * It can be used to run connection tests and identify common problems users might face
 */

// Connection test types
export enum ConnectionTestType {
  STUN = 'stun',
  TURN = 'turn',
  ICE = 'ice',
  MEDIA = 'media',
  BANDWIDTH = 'bandwidth',
  GENERAL = 'general',
}

// Result of a connectivity test
export interface ConnectivityResult {
  success: boolean;
  type: ConnectionTestType;
  details: string;
  timestamp: number;
  rttMs?: number; // Round trip time in milliseconds if available
  error?: Error;
}

// Collection of test results
export interface DiagnosticResults {
  stunConnectivity: ConnectivityResult;
  turnConnectivity: ConnectivityResult;
  mediaAccess: ConnectivityResult;
  iceConnectivity: ConnectivityResult;
  networkType?: string;
  bandwidthEstimate?: number;
}

// STUN servers to test connectivity
const TEST_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.ekiga.net:3478',
  'stun:global.stun.twilio.com:3478?transport=udp'
];

// TURN servers for connectivity testing
const TEST_TURN_SERVERS = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

/**
 * Test STUN server connectivity
 */
export async function testStunConnectivity(): Promise<ConnectivityResult> {
  const startTime = performance.now();
  const testServer = TEST_STUN_SERVERS[0]; // Use first server for basic test
  
  try {
    // Create RTCPeerConnection with the STUN server
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: testServer }]
    });
    
    // Create a data channel as trigger for ICE candidate gathering
    pc.createDataChannel('stunConnectivityTest');
    
    // Set up promise to wait for ICE candidates
    const stunPromise = new Promise<boolean>((resolve, reject) => {
      // Success - received server reflexive candidate
      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.type === 'srflx') {
          resolve(true);
        }
      };
      
      // Set timeout - assume failure if no srflx candidate after 5 seconds
      setTimeout(() => {
        resolve(false);
      }, 5000);
    });
    
    // Create offer to start ICE gathering
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const success = await stunPromise;
    const endTime = performance.now();
    
    // Clean up
    pc.close();
    
    return {
      success,
      type: ConnectionTestType.STUN,
      details: success ? `Successfully connected to STUN server (${testServer})` : 
                        `Failed to connect to STUN server (${testServer})`,
      timestamp: Date.now(),
      rttMs: endTime - startTime
    };
  } catch (error) {
    return {
      success: false,
      type: ConnectionTestType.STUN,
      details: `Error testing STUN connectivity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now(),
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Test TURN server connectivity
 */
export async function testTurnConnectivity(): Promise<ConnectivityResult> {
  const startTime = performance.now();
  const testServer = TEST_TURN_SERVERS[0]; // Use first server for basic test
  
  try {
    // Create RTCPeerConnection with the TURN server
    const pc = new RTCPeerConnection({
      iceServers: [testServer]
    });
    
    // Create a data channel as trigger for ICE candidate gathering
    pc.createDataChannel('turnConnectivityTest');
    
    // Set up promise to wait for ICE candidates
    const turnPromise = new Promise<boolean>((resolve, reject) => {
      // Success - received relay candidate
      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.type === 'relay') {
          resolve(true);
        }
      };
      
      // Set timeout - assume failure if no relay candidate after 8 seconds
      setTimeout(() => {
        resolve(false);
      }, 8000);
    });
    
    // Create offer to start ICE gathering
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const success = await turnPromise;
    const endTime = performance.now();
    
    // Clean up
    pc.close();
    
    return {
      success,
      type: ConnectionTestType.TURN,
      details: success ? `Successfully connected to TURN server (${testServer.urls})` : 
                        `Failed to connect to TURN server (${testServer.urls})`,
      timestamp: Date.now(),
      rttMs: endTime - startTime
    };
  } catch (error) {
    return {
      success: false,
      type: ConnectionTestType.TURN,
      details: `Error testing TURN connectivity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now(),
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Test media access (camera/microphone)
 */
export async function testMediaAccess(): Promise<ConnectivityResult> {
  const startTime = performance.now();
  
  try {
    // Try to access media devices
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    
    // Stop all tracks
    stream.getTracks().forEach(track => track.stop());
    
    const endTime = performance.now();
    
    return {
      success: true,
      type: ConnectionTestType.MEDIA,
      details: `Successfully accessed camera and microphone`,
      timestamp: Date.now(),
      rttMs: endTime - startTime
    };
  } catch (error) {
    // Determine the specific media error
    let details = 'Error accessing media devices';
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        details = 'Camera/microphone access denied by user';
      } else if (error.name === 'NotFoundError') {
        details = 'Camera or microphone device not found';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        details = 'Camera or microphone is being used by another application';
      } else if (error.name === 'OverconstrainedError') {
        details = 'The requested media settings are not supported by the device';
      }
    }
    
    return {
      success: false,
      type: ConnectionTestType.MEDIA,
      details,
      timestamp: Date.now(),
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Test ICE connectivity between two peer connections
 */
export async function testIceConnectivity(): Promise<ConnectivityResult> {
  const startTime = performance.now();
  
  try {
    // Create two peer connections to test connectivity
    const pc1 = new RTCPeerConnection({
      iceServers: [...TEST_STUN_SERVERS.map(url => ({ urls: url })), ...TEST_TURN_SERVERS]
    });
    
    const pc2 = new RTCPeerConnection({
      iceServers: [...TEST_STUN_SERVERS.map(url => ({ urls: url })), ...TEST_TURN_SERVERS]
    });
    
    // Create data channel for testing
    const dc1 = pc1.createDataChannel('connectivity-test');
    let connected = false;
    let dcOpened = false;
    
    // Set up datachannel handlers
    dc1.onopen = () => {
      dcOpened = true;
    };
    
    // Set up ICE candidate exchange
    pc1.onicecandidate = e => e.candidate && pc2.addIceCandidate(e.candidate);
    pc2.onicecandidate = e => e.candidate && pc1.addIceCandidate(e.candidate);
    
    // Handle datachannel on second peer
    pc2.ondatachannel = (e) => {
      const dc2 = e.channel;
      dc2.onopen = () => {
        dcOpened = true;
      };
    };
    
    // Connection state monitoring
    pc1.onconnectionstatechange = () => {
      if (pc1.connectionState === 'connected') {
        connected = true;
      }
    };
    
    // Create and exchange offers
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(pc1.localDescription!);
    
    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(pc2.localDescription!);
    
    // Wait for connection or timeout
    const connectionPromise = new Promise<boolean>((resolve) => {
      const checkState = () => {
        if (connected && dcOpened) {
          resolve(true);
          return;
        }
        
        // Check if connections have failed
        if (
          pc1.connectionState === 'failed' || 
          pc1.connectionState === 'closed' ||
          pc2.connectionState === 'failed' ||
          pc2.connectionState === 'closed'
        ) {
          resolve(false);
          return;
        }
        
        // Continue checking
        setTimeout(checkState, 500);
      };
      
      checkState();
      
      // Set timeout
      setTimeout(() => resolve(false), 10000);
    });
    
    const success = await connectionPromise;
    const endTime = performance.now();
    
    // Clean up
    pc1.close();
    pc2.close();
    
    return {
      success,
      type: ConnectionTestType.ICE,
      details: success ? `Successfully established ICE connection` : 
                        `Failed to establish ICE connection`,
      timestamp: Date.now(),
      rttMs: endTime - startTime
    };
  } catch (error) {
    return {
      success: false,
      type: ConnectionTestType.ICE,
      details: `Error testing ICE connectivity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now(),
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Determine network type (WiFi, cellular, etc.)
 * Note: This is an experimental feature and may not work in all browsers
 */
export function getNetworkType(): string {
  // Check if navigator.connection is available (Network Information API)
  if ('connection' in navigator && navigator.connection) {
    const conn = navigator.connection as any;
    if (conn.type) {
      return conn.type;
    }
    if (conn.effectiveType) {
      return conn.effectiveType;
    }
  }
  
  return 'unknown';
}

/**
 * Run all WebRTC diagnostic tests
 */
export async function runDiagnostics(): Promise<DiagnosticResults> {
  const stunResult = await testStunConnectivity();
  const turnResult = await testTurnConnectivity();
  const mediaResult = await testMediaAccess();
  const iceResult = await testIceConnectivity();
  
  return {
    stunConnectivity: stunResult,
    turnConnectivity: turnResult,
    mediaAccess: mediaResult,
    iceConnectivity: iceResult,
    networkType: getNetworkType(),
  };
}

/**
 * Format diagnostic results as a user-friendly message
 */
export function formatDiagnosticResults(results: DiagnosticResults): string {
  const successCount = [
    results.stunConnectivity,
    results.turnConnectivity,
    results.mediaAccess,
    results.iceConnectivity
  ].filter(r => r.success).length;
  
  const totalTests = 4;
  const successRate = Math.round((successCount / totalTests) * 100);
  
  let summary = `WebRTC Diagnostics Result: ${successRate}% Success\n\n`;
  
  summary += `Network Type: ${results.networkType || 'unknown'}\n`;
  summary += `STUN Connectivity: ${results.stunConnectivity.success ? '✅ Success' : '❌ Failed'}\n`;
  summary += `TURN Connectivity: ${results.turnConnectivity.success ? '✅ Success' : '❌ Failed'}\n`;
  summary += `Media Access: ${results.mediaAccess.success ? '✅ Success' : '❌ Failed'}\n`;
  summary += `ICE Connectivity: ${results.iceConnectivity.success ? '✅ Success' : '❌ Failed'}\n\n`;
  
  if (!results.stunConnectivity.success) {
    summary += `- ${results.stunConnectivity.details}\n`;
  }
  
  if (!results.turnConnectivity.success) {
    summary += `- ${results.turnConnectivity.details}\n`;
  }
  
  if (!results.mediaAccess.success) {
    summary += `- ${results.mediaAccess.details}\n`;
  }
  
  if (!results.iceConnectivity.success) {
    summary += `- ${results.iceConnectivity.details}\n`;
  }
  
  // Add recommendations based on failures
  if (!results.stunConnectivity.success || !results.turnConnectivity.success) {
    summary += "\nRecommendations for Network Issues:\n";
    summary += "- Check your firewall settings for WebRTC traffic\n";
    summary += "- Try using a different network connection\n";
    summary += "- Disable VPN if you are using one\n";
  }
  
  if (!results.mediaAccess.success) {
    summary += "\nRecommendations for Media Issues:\n";
    summary += "- Check browser permissions for camera and microphone\n";
    summary += "- Make sure your camera is not being used by another application\n";
    summary += "- Try using different camera/microphone devices if available\n";
  }
  
  return summary;
}

// Export a simple diagnostic function for use in the WebRTC service
export async function checkWebRTCConnectivity(): Promise<{
  canConnect: boolean;
  details: string;
}> {
  try {
    const stunResult = await testStunConnectivity();
    const turnResult = await testTurnConnectivity();
    
    // We consider the connection viable if either STUN or TURN works
    const canConnect = stunResult.success || turnResult.success;
    
    let details = '';
    if (canConnect) {
      details = stunResult.success 
        ? 'Can connect via STUN' 
        : 'Can connect via TURN';
    } else {
      details = 'Cannot connect via either STUN or TURN. Network connectivity issues likely.';
    }
    
    return { canConnect, details };
  } catch (error) {
    return { 
      canConnect: false, 
      details: `Error checking WebRTC connectivity: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
