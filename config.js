/**
 * config.js — loaded first on every page.
 * Hardcoded to spenium's ermn Supabase project.
 * All other scripts reference window.ERMN_URL / window.ERMN_KEY / window.ERMN_SPENIUM.
 */
(function () {
  window.ERMN_SPENIUM = true;
  window.ERMN_URL = "https://kibepwdosrjxbauxnjtn.supabase.co";
  window.ERMN_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpYmVwd2Rvc3JqeGJhdXhuanRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDczMzAsImV4cCI6MjA5MjQ4MzMzMH0._bfs8jCBRSKCkHJ6T-0SIl2j_TnGliAW6zw7OLl08Sk";
})();

window.uiPrompt = function (msg, def) {
  if (document.getElementById("ui-modal-bg")) return Promise.resolve(null);
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.id = "ui-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg, #fff);padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;width:100%;font-family:Tahoma,Verdana,sans-serif;";
    const txt = document.createElement("div");
    txt.innerText = msg;
    txt.style.cssText = "margin-bottom:15px;color:var(--text, #333);font-size:14px;white-space:pre-wrap;";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = def || "";
    inp.style.cssText = "width:100%;padding:8px;margin-bottom:15px;border:1px solid var(--border, #ccc);border-radius:4px;box-sizing:border-box;background:#fafafa;color:#333;";
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;";
    const btnCancel = document.createElement("button");
    btnCancel.innerText = "Cancel";
    btnCancel.style.cssText = "padding:6px 12px;background:transparent;color:var(--text, #333);border:1px solid var(--border, #ccc);border-radius:4px;cursor:pointer;margin-right:8px;";
    btnCancel.onclick = () => { document.body.removeChild(bg); resolve(null); };
    const btnOk = document.createElement("button");
    btnOk.innerText = "OK";
    btnOk.style.cssText = "padding:6px 12px;background:var(--accent, #3b5998);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;";
    btnOk.onclick = () => { document.body.removeChild(bg); resolve(inp.value); };
    inp.onkeydown = (e) => { if (e.key === "Enter") btnOk.click(); if (e.key === "Escape") btnCancel.click(); };
    btns.appendChild(btnCancel);
    btns.appendChild(btnOk);
    box.appendChild(txt);
    box.appendChild(inp);
    box.appendChild(btns);
    bg.appendChild(box);
    document.body.appendChild(bg);
    setTimeout(() => inp.focus(), 50);
  });
};

window.uiConfirm = function (msg) {
  if (document.getElementById("ui-modal-bg")) return Promise.resolve(false);
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.id = "ui-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg, #fff);padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;width:100%;font-family:Tahoma,Verdana,sans-serif;";
    const txt = document.createElement("div");
    txt.innerText = msg;
    txt.style.cssText = "margin-bottom:15px;color:var(--text, #333);font-size:14px;white-space:pre-wrap;";
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;";
    const btnCancel = document.createElement("button");
    btnCancel.innerText = "Cancel";
    btnCancel.style.cssText = "padding:6px 12px;background:transparent;color:var(--text, #333);border:1px solid var(--border, #ccc);border-radius:4px;cursor:pointer;margin-right:8px;";
    btnCancel.onclick = () => { document.body.removeChild(bg); resolve(false); };
    const btnOk = document.createElement("button");
    btnOk.innerText = "OK";
    btnOk.style.cssText = "padding:6px 12px;background:var(--accent, #3b5998);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;";
    btnOk.onclick = () => { document.body.removeChild(bg); resolve(true); };
    btns.appendChild(btnCancel);
    btns.appendChild(btnOk);
    box.appendChild(txt);
    box.appendChild(btns);
    bg.appendChild(box);
    document.body.appendChild(bg);
    setTimeout(() => btnOk.focus(), 50);
  });
};

window.uiAlert = function (msg) {
  if (document.getElementById("ui-modal-bg")) return Promise.resolve();
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.id = "ui-modal-bg";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card-bg, #fff);padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;width:100%;font-family:Tahoma,Verdana,sans-serif;";
    const txt = document.createElement("div");
    txt.innerText = msg;
    txt.style.cssText = "margin-bottom:15px;color:var(--text, #333);font-size:14px;white-space:pre-wrap;";
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;";
    const btnOk = document.createElement("button");
    btnOk.innerText = "OK";
    btnOk.style.cssText = "padding:6px 12px;background:var(--accent, #3b5998);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;";
    btnOk.onclick = () => { document.body.removeChild(bg); resolve(); };
    btns.appendChild(btnOk);
    box.appendChild(txt);
    box.appendChild(btns);
    bg.appendChild(box);
    document.body.appendChild(bg);
    setTimeout(() => btnOk.focus(), 50);
  });
};
