import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const DEFAULT_RECONNECT_DELAY_MS = 3000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

const getWebRtcBaseUrl = () => {
  const explicitUrl = String(import.meta.env.VITE_MEDIA_MTX_WEBRTC_BASE_URL || "").trim();
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const serverIp = String(import.meta.env.VITE_SERVER_IP || "").trim();
  if (serverIp) {
    return `http://${serverIp}:8889`;
  }

  // Fall back to the same origin so requests go through Nginx's /webrtc/ proxy.
  return `${window.location.protocol}//${window.location.host}/webrtc`;
};

const WEBRTC_BASE_URL = getWebRtcBaseUrl();

const MediaMTXWebRTCPlayer = forwardRef(function MediaMTXWebRTCPlayer({
  streamName,
  width,
  height,
  autoPlay = true
}, ref) {
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const generationRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const disposedRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState("");

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearVideoSource = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    const currentObject = videoElement.srcObject;
    if (currentObject && typeof currentObject.getTracks === "function") {
      currentObject.getTracks().forEach((track) => track.stop());
    }

    videoElement.srcObject = null;
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
      } catch (error) {
        // Ignore peer close errors during cleanup.
      }

      peerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearReconnectTimer();
    closePeerConnection();
    clearVideoSource();
  }, [clearReconnectTimer, closePeerConnection, clearVideoSource]);

  const scheduleReconnect = useCallback((reason, startConnection) => {
    if (disposedRef.current) {
      return;
    }

    const normalizedReason = reason instanceof Error ? reason.message : String(reason || "WebRTC failed");

    if (reconnectAttemptsRef.current >= DEFAULT_MAX_RECONNECT_ATTEMPTS) {
      setErrorMessage(`${normalizedReason}. Reconnect limit reached.`);
      return;
    }

    reconnectAttemptsRef.current += 1;
    setErrorMessage(`${normalizedReason}. Reconnecting... (${reconnectAttemptsRef.current}/${DEFAULT_MAX_RECONNECT_ATTEMPTS})`);

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      startConnection();
    }, DEFAULT_RECONNECT_DELAY_MS);
  }, [clearReconnectTimer]);

  const startConnection = useCallback(async () => {
    const stream = String(streamName || "").trim();
    if (!stream || disposedRef.current) {
      return;
    }

    const currentGeneration = generationRef.current;
    clearReconnectTimer();
    closePeerConnection();

    try {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      peer.addTransceiver("video", {
        direction: "recvonly"
      });

      peer.ontrack = async (event) => {
        if (disposedRef.current || generationRef.current !== currentGeneration) {
          return;
        }

        const [mediaStream] = event.streams || [];
        if (!videoRef.current || !mediaStream) {
          return;
        }

        videoRef.current.srcObject = mediaStream;
        setErrorMessage("");
        reconnectAttemptsRef.current = 0;

        if (autoPlay) {
          try {
            await videoRef.current.play();
          } catch (playError) {
            // Autoplay may be blocked by browser policy.
          }
        }
      };

      peer.onconnectionstatechange = () => {
        if (disposedRef.current || generationRef.current !== currentGeneration) {
          return;
        }

        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          scheduleReconnect(new Error(`Connection ${peer.connectionState}`), startConnection);
        }
      };

      const offer = await peer.createOffer();
      if (disposedRef.current || generationRef.current !== currentGeneration) {
        return;
      }

      await peer.setLocalDescription(offer);

      const whepUrl = `${WEBRTC_BASE_URL}/${encodeURIComponent(stream)}/whep`;
      const response = await fetch(whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });

      if (!response.ok) {
        throw new Error(`WHEP HTTP ${response.status}`);
      }

      const answerSdp = await response.text();
      if (disposedRef.current || generationRef.current !== currentGeneration) {
        return;
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });
    } catch (error) {
      closePeerConnection();
      scheduleReconnect(error, startConnection);
    }
  }, [autoPlay, clearReconnectTimer, closePeerConnection, scheduleReconnect, streamName]);

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current
  }), []);

  useEffect(() => {
    disposedRef.current = false;
    generationRef.current += 1;
    reconnectAttemptsRef.current = 0;
    setErrorMessage("");

    startConnection();

    return () => {
      disposedRef.current = true;
      generationRef.current += 1;
      cleanup();
    };
  }, [streamName, startConnection, cleanup]);

  return (
    <div style={{ width, height, position: "relative", background: "#000" }}>
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        muted
        controls
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: "#000"
        }}
      />

      {errorMessage && (
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            background: "rgba(0,0,0,0.65)",
            color: "#fbbf24",
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.3,
            padding: "4px 6px"
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
});

export default MediaMTXWebRTCPlayer;
