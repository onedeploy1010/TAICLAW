/**
 * Robust clipboard copy that works on Huawei browsers, iOS Safari, Android WebView, etc.
 * Tries multiple methods in sequence until one succeeds.
 */
export async function copyText(text: string): Promise<boolean> {
  // Method 1: Modern Clipboard API
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API failed, try fallback
  }

  // Method 2: textarea + execCommand (widest compatibility)
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Prevent zoom on iOS
    ta.style.fontSize = "16px";
    // Move off-screen but keep visible (some browsers need it visible)
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);

    // iOS Safari needs special handling
    const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      ta.setSelectionRange(0, text.length);
    } else {
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
    }

    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    // execCommand failed too
  }

  // Method 3: input element fallback (some Android WebViews prefer input over textarea)
  try {
    const input = document.createElement("input");
    input.type = "text";
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.setAttribute("readonly", "");
    document.body.appendChild(input);
    input.focus();
    input.select();
    input.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    if (ok) return true;
  } catch {
    // All methods failed
  }

  return false;
}
