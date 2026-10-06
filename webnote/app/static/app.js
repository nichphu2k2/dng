(() => {
  const line1Input = document.getElementById("line1");
  const line2Input = document.getElementById("line2");
  const line3Input = document.getElementById("line3");
  const copyLine1Btn = document.getElementById("copy-line1");
  const copyLine2Btn = document.getElementById("copy-line2");
  const copyLine3Btn = document.getElementById("copy-line3");
  const editor = document.getElementById("editor");
  const statusBadge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");
  const toast = document.getElementById("toast");

  let currentVersion = 0;
  let ws = null;
  let reconnectTimeout = null;
  let reconnectDelay = 1000;
  let debounceTimer = null;
  let isFocusedInEditor = false;

  function showToast(message, duration = 2000) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  function setStatus(state, text) {
    statusBadge.className = "status-badge " + state;
    statusText.textContent = text;
  }

  function setupCopyButton(btn, inputElement) {
    btn.addEventListener("click", async () => {
      const textToCopy = inputElement.value || "";
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove("copied");
        }, 1500);
      } catch (err) {
        try {
          inputElement.select();
          document.execCommand("copy");
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.classList.remove("copied");
          }, 1500);
        } catch (fallbackErr) {
          showToast("Không thể copy vào clipboard");
        }
      }
    });
  }

  setupCopyButton(copyLine1Btn, line1Input);
  setupCopyButton(copyLine2Btn, line2Input);
  setupCopyButton(copyLine3Btn, line3Input);

  function serializeEditor(rootNode) {
    const blocks = [];

    function traverse(node) {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        if (text) {
          if (blocks.length > 0 && blocks[blocks.length - 1].type === "text") {
            blocks[blocks.length - 1].content += text;
          } else {
            blocks.push({ type: "text", content: text });
          }
        }
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;

        if (el.classList && el.classList.contains("editor-image-item")) {
          const img = el.querySelector("img");
          const imgId = el.dataset.imageId || (img ? img.dataset.imageId : "");
          const src = img ? img.getAttribute("src") : "";
          if (imgId && src) {
            blocks.push({ type: "image", id: imgId, src: src });
          }
          return;
        }

        if (el.tagName === "IMG") {
          const imgId = el.dataset.imageId || "";
          const src = el.getAttribute("src") || "";
          if (src) {
            blocks.push({ type: "image", id: imgId, src: src });
          }
          return;
        }

        if (el.tagName === "BR") {
          if (blocks.length > 0 && blocks[blocks.length - 1].type === "text") {
            blocks[blocks.length - 1].content += "\n";
          } else {
            blocks.push({ type: "text", content: "\n" });
          }
          return;
        }

        const isBlockElement = ["DIV", "P", "H1", "H2", "H3", "LI"].includes(el.tagName);
        if (isBlockElement && blocks.length > 0) {
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock.type === "text" && !lastBlock.content.endsWith("\n")) {
            lastBlock.content += "\n";
          }
        }

        for (let i = 0; i < el.childNodes.length; i++) {
          traverse(el.childNodes[i]);
        }
      }
    }

    for (let i = 0; i < rootNode.childNodes.length; i++) {
      traverse(rootNode.childNodes[i]);
    }

    return JSON.stringify({ type: "document", blocks });
  }

  function createImageElement(imageId, src) {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-image-item";
    wrapper.contentEditable = "false";
    wrapper.dataset.imageId = imageId;

    const img = document.createElement("img");
    img.src = src;
    img.dataset.imageId = imageId;
    img.alt = "Pasted image";
    img.loading = "lazy";

    const overlay = document.createElement("div");
    overlay.className = "editor-image-overlay";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-img-action";
    copyBtn.textContent = "Copy Image";
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await copyImageToClipboard(src, copyBtn);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-img-action";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      wrapper.remove();
      triggerDebouncedUpdate(true);
    });

    overlay.appendChild(copyBtn);
    overlay.appendChild(deleteBtn);
    wrapper.appendChild(img);
    wrapper.appendChild(overlay);

    return wrapper;
  }

  function renderDocument(jsonStr) {
    editor.innerHTML = "";
    if (!jsonStr) return;

    try {
      const data = JSON.parse(jsonStr);
      if (data && Array.isArray(data.blocks)) {
        for (const block of data.blocks) {
          if (block.type === "text") {
            const lines = (block.content || "").split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (lines[i]) {
                editor.appendChild(document.createTextNode(lines[i]));
              }
              if (i < lines.length - 1) {
                editor.appendChild(document.createElement("br"));
              }
            }
          } else if (block.type === "image") {
            const imgEl = createImageElement(block.id, block.src);
            editor.appendChild(imgEl);
            editor.appendChild(document.createTextNode(" "));
          }
        }
      }
    } catch (e) {
      editor.innerText = jsonStr;
    }
  }

  async function copyImageToClipboard(imageSrc, buttonEl) {
    try {
      const response = await fetch(imageSrc);
      if (!response.ok) {
        throw new Error("Không thể tải ảnh");
      }
      const blob = await response.blob();

      let clipboardBlob = blob;
      if (blob.type !== "image/png") {
        clipboardBlob = await convertBlobToPng(blob);
      }

      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ "image/png": clipboardBlob });
        await navigator.clipboard.write([item]);
        if (buttonEl) {
          const prev = buttonEl.textContent;
          buttonEl.textContent = "Copied!";
          buttonEl.classList.add("copied");
          setTimeout(() => {
            buttonEl.textContent = prev;
            buttonEl.classList.remove("copied");
          }, 1500);
        }
        showToast("Đã copy ảnh vào clipboard!");
      } else {
        throw new Error("ClipboardItem API không hỗ trợ");
      }
    } catch (err) {
      showToast("Trình duyệt không hỗ trợ copy trực tiếp file ảnh!");
    }
  }

  function convertBlobToPng(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          if (pngBlob) {
            resolve(pngBlob);
          } else {
            resolve(blob);
          }
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.src = url;
    });
  }

  function sendUpdate() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = {
      type: "update",
      version: currentVersion,
      line1: line1Input.value,
      line2: line2Input.value,
      line3: line3Input.value,
      content: serializeEditor(editor)
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }
  }

  function triggerDebouncedUpdate(immediate = false) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (immediate) {
      sendUpdate();
    } else {
      debounceTimer = setTimeout(() => {
        sendUpdate();
      }, 300);
    }
  }

  async function uploadImageFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    showToast("Đang tải ảnh lên...");
    try {
      const resp = await fetch("/api/images", {
        method: "POST",
        body: formData
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload thất bại");
      }

      const data = await resp.json();
      showToast("Tải ảnh thành công!");
      return data;
    } catch (err) {
      showToast("Lỗi: " + err.message);
      return null;
    }
  }

  function insertImageAtCaret(imageElement) {
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(imageElement);
        range.setStartAfter(imageElement);
        range.setEndAfter(imageElement);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }
    editor.appendChild(imageElement);
  }

  editor.addEventListener("paste", async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    let imageItem = null;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          imageItem = items[i];
          break;
        }
      }
    }

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;

      const uploadResult = await uploadImageFile(file);
      if (uploadResult) {
        const imgEl = createImageElement(uploadResult.image_id, uploadResult.src);
        insertImageAtCaret(imgEl);
        triggerDebouncedUpdate(true);
      }
    }
  });

  editor.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  editor.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        const uploadResult = await uploadImageFile(file);
        if (uploadResult) {
          const imgEl = createImageElement(uploadResult.image_id, uploadResult.src);
          insertImageAtCaret(imgEl);
          triggerDebouncedUpdate(true);
        }
      }
    }
  });

  editor.addEventListener("input", () => {
    triggerDebouncedUpdate(false);
  });

  editor.addEventListener("focus", () => {
    isFocusedInEditor = true;
  });

  editor.addEventListener("blur", () => {
    isFocusedInEditor = false;
  });

  [line1Input, line2Input, line3Input].forEach((input) => {
    input.addEventListener("input", () => {
      triggerDebouncedUpdate(false);
    });
  });

  function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    setStatus("reconnecting", "Connecting...");

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      setStatus("connected", "Connected");
      reconnectDelay = 1000;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (e) {
        console.error(e);
      }
    };

    ws.onclose = () => {
      setStatus("reconnecting", "Reconnecting...");
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return;
    setStatus("reconnecting", "Reconnecting...");
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
      connectWebSocket();
    }, reconnectDelay);
  }

  function handleServerMessage(data) {
    const msgType = data.type;

    if (msgType === "init" || msgType === "document_update") {
      const serverVersion = data.version || 0;

      if (serverVersion < currentVersion && msgType !== "init") {
        return;
      }

      currentVersion = serverVersion;

      if (document.activeElement !== line1Input) {
        line1Input.value = data.line1 || "";
      }
      if (document.activeElement !== line2Input) {
        line2Input.value = data.line2 || "";
      }
      if (document.activeElement !== line3Input) {
        line3Input.value = data.line3 || "";
      }

      const currentSerialized = serializeEditor(editor);
      if (currentSerialized !== data.content) {
        renderDocument(data.content);
      }
    }
  }

  connectWebSocket();
})();
