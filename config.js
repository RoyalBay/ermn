/**
 * config.js — loaded first on every page.
 * Hardcoded to the ermn Supabase project.
 * All other scripts reference window.ERMN_URL / window.ERMN_KEY.
 */
(function () {
  window.ERMN_URL = "https://https://glxkfdltajezuvptippt.supabase.co";
  window.ERMN_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdseGtmZGx0YWplenV2cHRpcHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNDA0NDcsImV4cCI6MjA5MjgxNjQ0N30.2PTpFCp20SHOlLcgxldYNHAtVxnsB8UuP6n8HpCa944";
})();

window.uiPrompt = function (msg, def) {
  if (document.getElementById("ui-modal-bg")) return Promise.resolve(null);
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.id = "ui-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);opacity:0;transition:opacity 0.2s;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg, #fff);padding:24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.4);max-width:400px;width:100%;font-family:inherit;transform:scale(0.9);transition:transform 0.2s;border:1px solid var(--border, #ccc);";
    const txt = document.createElement("div");
    txt.innerText = msg;
    txt.style.cssText = "margin-bottom:18px;color:var(--text, #333);font-size:15px;line-height:1.5;white-space:pre-wrap;font-weight:500;";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = def || "";
    inp.style.cssText = "width:100%;padding:10px;margin-bottom:20px;border:1px solid var(--border, #ccc);border-radius:6px;box-sizing:border-box;background:rgba(0,0,0,0.03);color:var(--text, #333);font-family:inherit;outline:none;";
    inp.onfocus = () => { inp.style.borderColor = "var(--accent)"; };
    inp.onblur = () => { inp.style.borderColor = "var(--border)"; };
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;gap:10px;";
    const btnCancel = document.createElement("button");
    btnCancel.innerText = "Cancel";
    btnCancel.style.cssText = "padding:8px 16px;background:transparent;color:var(--text, #333);border:1px solid var(--border, #ccc);border-radius:6px;cursor:pointer;font-family:inherit;font-size:14px;transition:background 0.2s;";
    btnCancel.onmouseover = () => { btnCancel.style.background = "rgba(0,0,0,0.05)"; };
    btnCancel.onmouseout = () => { btnCancel.style.background = "transparent"; };
    btnCancel.onclick = () => { 
      bg.style.opacity = "0"; box.style.transform = "scale(0.9)";
      setTimeout(() => { document.body.removeChild(bg); resolve(null); }, 200);
    };
    const btnOk = document.createElement("button");
    btnOk.innerText = "OK";
    btnOk.style.cssText = "padding:8px 20px;background:var(--accent, #3b5998);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.2);";
    btnOk.onclick = () => { 
      bg.style.opacity = "0"; box.style.transform = "scale(0.9)";
      setTimeout(() => { document.body.removeChild(bg); resolve(inp.value); }, 200);
    };
    inp.onkeydown = (e) => { if (e.key === "Enter") btnOk.click(); if (e.key === "Escape") btnCancel.click(); };
    btns.appendChild(btnCancel);
    btns.appendChild(btnOk);
    box.appendChild(txt);
    box.appendChild(inp);
    box.appendChild(btns);
    bg.appendChild(box);
    document.body.appendChild(bg);
    requestAnimationFrame(() => { bg.style.opacity = "1"; box.style.transform = "scale(1)"; });
    setTimeout(() => inp.focus(), 50);
  });
};

window.uiConfirm = function (msg) {
  if (document.getElementById("ui-modal-bg")) return Promise.resolve(false);
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.id = "ui-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);opacity:0;transition:opacity 0.2s;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg, #fff);padding:24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.4);max-width:400px;width:100%;font-family:inherit;transform:scale(0.9);transition:transform 0.2s;border:1px solid var(--border, #ccc);";
    const txt = document.createElement("div");
    txt.innerText = msg;
    txt.style.cssText = "margin-bottom:20px;color:var(--text, #333);font-size:15px;line-height:1.5;white-space:pre-wrap;font-weight:500;";
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;gap:10px;";
    const btnCancel = document.createElement("button");
    btnCancel.innerText = "Cancel";
    btnCancel.style.cssText = "padding:8px 16px;background:transparent;color:var(--text, #333);border:1px solid var(--border, #ccc);border-radius:6px;cursor:pointer;font-family:inherit;font-size:14px;transition:background 0.2s;";
    btnCancel.onclick = () => { 
      bg.style.opacity = "0"; box.style.transform = "scale(0.9)";
      setTimeout(() => { document.body.removeChild(bg); resolve(false); }, 200);
    };
    const btnOk = document.createElement("button");
    btnOk.innerText = "OK";
    btnOk.style.cssText = "padding:8px 20px;background:var(--accent, #3b5998);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.2);";
    btnOk.onclick = () => { 
      bg.style.opacity = "0"; box.style.transform = "scale(0.9)";
      setTimeout(() => { document.body.removeChild(bg); resolve(true); }, 200);
    };
    btns.appendChild(btnCancel);
    btns.appendChild(btnOk);
    box.appendChild(txt);
    box.appendChild(btns);
    bg.appendChild(box);
    document.body.appendChild(bg);
    requestAnimationFrame(() => { bg.style.opacity = "1"; box.style.transform = "scale(1)"; });
    setTimeout(() => btnOk.focus(), 50);
  });
};

window.uiAlert = function (msg) {
  if (document.getElementById("ui-modal-bg")) return Promise.resolve();
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.id = "ui-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);opacity:0;transition:opacity 0.2s;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg, #fff);padding:24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.4);max-width:400px;width:100%;font-family:inherit;transform:scale(0.9);transition:transform 0.2s;border:1px solid var(--border, #ccc);";
    const txt = document.createElement("div");
    txt.innerText = msg;
    txt.style.cssText = "margin-bottom:20px;color:var(--text, #333);font-size:15px;line-height:1.5;white-space:pre-wrap;font-weight:500;";
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;";
    const btnOk = document.createElement("button");
    btnOk.innerText = "OK";
    btnOk.style.cssText = "padding:8px 24px;background:var(--accent, #3b5998);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.2);";
    btnOk.onclick = () => { 
      bg.style.opacity = "0"; box.style.transform = "scale(0.9)";
      setTimeout(() => { document.body.removeChild(bg); resolve(); }, 200);
    };
    btns.appendChild(btnOk);
    box.appendChild(txt);
    box.appendChild(btns);
    bg.appendChild(box);
    document.body.appendChild(bg);
    requestAnimationFrame(() => { bg.style.opacity = "1"; box.style.transform = "scale(1)"; });
    setTimeout(() => btnOk.focus(), 50);
  });
};
