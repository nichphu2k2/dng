import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import MediaMTXWebRTCPlayer from "./MediaMTXWebRTCPlayer";

const WINDOW_WIDTH = 268;
const WINDOW_HEIGHT = 205;

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const normalizePosition = (position, width, height) => {
  const maxLeft = Math.max(
    8,
    window.innerWidth - width - 8
  );

  const maxTop = Math.max(
    8,
    window.innerHeight - height - 8
  );

  return {
    left: clamp(position?.left ?? 16, 8, maxLeft),
    top: clamp(position?.top ?? 16, 8, maxTop)
  };
};

export default function CameraLiveWindow({
  open,
  title,
  streamName,
  initialPosition,
  width = WINDOW_WIDTH,
  height = WINDOW_HEIGHT,
  baseZIndex = 40,
  onClose,
  onActivate,
  onPositionChange
}) {

  const windowRef = useRef(null);

  const dragOffsetRef = useRef({
    x: 0,
    y: 0
  });


  const [position, setPosition] = useState({
    left: 16,
    top: 16
  });

  const [dragging, setDragging] = useState(false);

  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {

    if (!open) {
      setDragging(false);
      setFullscreen(false);
      return;
    }

    setPosition(
      normalizePosition(
        initialPosition,
        width,
        height
      )
    );

  }, [
    open,
    initialPosition,
    width,
    height
  ]);

  useEffect(() => {

    if (!open) return;


    const onMouseMove = (event) => {

      if (!dragging || fullscreen) return;


      const maxLeft = Math.max(
        8,
        window.innerWidth - width - 8
      );

      const maxTop = Math.max(
        8,
        window.innerHeight - height - 8
      );

      setPosition({
        left: clamp(
          event.clientX - dragOffsetRef.current.x,
          8,
          maxLeft
        ),

        top: clamp(
          event.clientY - dragOffsetRef.current.y,
          8,
          maxTop
        )
      });
    };
    const onMouseUp = () => {
      setDragging(false);
    };
    window.addEventListener(
      "mousemove",
      onMouseMove
    );
    window.addEventListener(
      "mouseup",
      onMouseUp
    );
    return () => {
      window.removeEventListener(
        "mousemove",
        onMouseMove
      );
      window.removeEventListener(
        "mouseup",
        onMouseUp
      );
    };
  }, [
    dragging,
    fullscreen,
    open,
    width,
    height
  ]);

  useEffect(() => {
    if (!open || fullscreen) {
      return;
    }

    onPositionChange?.(position);
  }, [open, fullscreen, position, onPositionChange]);
  const handleKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (fullscreen) {
        setFullscreen(false);
      } else {
        onClose?.();
      }
      return;
    }
    if (
      event.key.toLowerCase() === "f"
    ) {
      event.preventDefault();
      setFullscreen(
        prev => !prev
      );

    }
  }, [
    fullscreen,
    onClose
  ]);
  if (!open) {
    return null;
  }
  const windowStyle = fullscreen
    ? {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(92vw,920px)",
        height: "min(84vh,640px)",
        zIndex: baseZIndex + 5
      }
    : {
        position: "fixed",
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: baseZIndex
      };
  return (

    <div
      ref={windowRef}
      tabIndex={0}
      onFocus={() => onActivate?.()}
      onMouseDown={(e)=>{
        onActivate?.();
        e.currentTarget.focus();
      }}
      onKeyDown={handleKeyDown}
      style={{
        ...windowStyle,
        border: "1px solid #1f2937",
        borderRadius: 8,
        overflow: "hidden",
        background:"#000",
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.35)",
        display:"flex",
        flexDirection:"column",
        userSelect:"none"
      }}
    >


      <div
        onMouseDown={(event)=>{
          if(fullscreen) return;
          const rect =
            windowRef.current
            ?.getBoundingClientRect();
          if (!rect) return;
          dragOffsetRef.current = {
            x:
              event.clientX - rect.left,
            y:
              event.clientY - rect.top
          };
          setDragging(true);
        }}
        style={{
          height:32,
          background:
            "rgba(17,24,39,0.95)",
          color:"#f9fafb",
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          padding:"0 8px",
          cursor:
            fullscreen
            ? "default"
            : "move"
        }}
      >
        <span
          style={{
            overflow:"hidden",
            textOverflow:"ellipsis",
            whiteSpace:"nowrap",
            fontSize:12
          }}
        >
          {title || "Live View"}
        </span>
        <Button
          size="small"
          type="text"
          icon={
            <CloseOutlined
              style={{
                color:"#f9fafb"
              }}
            />
          }
          onClick={onClose}
        />
      </div>
      <MediaMTXWebRTCPlayer
        streamName={streamName}
        width="100%"

        height={
          fullscreen
          ? "calc(100% - 32px)"
          : `calc(${height}px - 32px)`
        }
        autoPlay
      />
    </div>
  );
}