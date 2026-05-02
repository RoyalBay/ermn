// Developer Tools Loader
// This script runs site-wide and applies developer settings

(function() {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 600;
    if (isMobile) return;

    const isDeveloper = localStorage.getItem("isDeveloper") === "true";
    if (!isDeveloper) return;

    const style = document.createElement('style');
    style.textContent = `
      /* Dev Layouts */
      body.layout-compact { font-size: 11px !important; }
      body.layout-compact .post { padding: 4px 8px !important; margin-bottom: 4px !important; }
      body.layout-compact .container { gap: 6px !important; }
      body.layout-compact .sidebar { width: 180px !important; }
      body.layout-compact .topbar { height: 36px !important; }
      body.layout-compact .post-avatar { width: 30px !important; height: 30px !important; }

      body.layout-minimal .sidebar { display: none !important; }
      body.layout-minimal .container { max-width: 650px !important; }
      body.layout-minimal .search-bar, body.layout-minimal .compose-box { margin-bottom: 6px !important; }

      body.layout-lite * { animation: none !important; transition: none !important; box-shadow: none !important; }
      body.layout-lite .topbar { box-shadow: none !important; border-bottom: 1px solid #ccc !important; }

      /* Dev Console & FPS Meter */
      #dev-fps-meter, #dev-resource-monitor {
        position: fixed; top: 0; background: rgba(0,0,0,0.7); color: #0f0; 
        font-family: monospace; font-size: 10px; padding: 2px 4px; z-index: 10000; pointer-events: none;
      }
      #dev-fps-meter { left: 0; }
      #dev-resource-monitor { left: 50px; color: #0af; }

      #dev-console-overlay {
        position: fixed; bottom: 0; left: 0; right: 0; height: 180px; 
        background: rgba(0,0,0,0.9); color: #fff; font-family: monospace; font-size: 10px; 
        z-index: 9999; overflow-y: auto; border-top: 2px solid #444; display: none;
      }
      .dev-console-header {
        position: sticky; top: 0; background: #222; padding: 4px 8px; border-bottom: 1px solid #444;
        display: flex; justify-content: space-between; align-items: center;
      }
      .dev-log-entry { padding: 2px 8px; border-bottom: 1px solid #333; white-space: pre-wrap; font-family: monospace; }
      .dev-log-error { color: #ff5555; }
      .dev-log-network { color: #55aaff; }
    `;
    document.head.appendChild(style);

    // Apply Layout
    const layout = localStorage.getItem("dev_layout") || "classic";
    if (layout !== "classic") {
        const applyLayout = () => {
            if (document.body) document.body.classList.add("layout-" + layout);
            else setTimeout(applyLayout, 10);
        };
        applyLayout();
    }

    // FPS Meter
    if (localStorage.getItem("dev_fps") === "true") {
        document.addEventListener("DOMContentLoaded", () => {
            const meter = document.createElement("div");
            meter.id = "dev-fps-meter";
            document.body.appendChild(meter);
            let lastTime = performance.now();
            let frames = 0;
            function updateFPS() {
                frames++;
                const now = performance.now();
                if (now >= lastTime + 1000) {
                    meter.innerText = Math.round((frames * 1000) / (now - lastTime)) + " FPS";
                    frames = 0;
                    lastTime = now;
                }
                requestAnimationFrame(updateFPS);
            }
            requestAnimationFrame(updateFPS);
        });
    }

    // Resource Monitor
    if (localStorage.getItem("dev_resources") === "true") {
        document.addEventListener("DOMContentLoaded", () => {
            const res = document.createElement("div");
            res.id = "dev-resource-monitor";
            document.body.appendChild(res);
            setInterval(() => {
                const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + "MB" : "N/A";
                res.innerText = "MEM: " + mem;
            }, 1000);
        });
    }

    // Error Console & Network Log
    const showConsole = localStorage.getItem("dev_console") === "true";
    const showNetwork = localStorage.getItem("dev_network") === "true";
    
    if (showConsole || showNetwork) {
        document.addEventListener("DOMContentLoaded", () => {
            const overlay = document.createElement("div");
            overlay.id = "dev-console-overlay";
            overlay.style.display = "block";
            overlay.innerHTML = `<div class="dev-console-header">
                <span>Dev Console ${showNetwork?'& Network':''}</span>
                <button onclick="this.parentElement.parentElement.style.display='none'" style="background:#444;color:#fff;border:none;padding:2px 6px;cursor:pointer;font-size:10px;">Hide</button>
            </div><div class="dev-logs"></div>`;
            document.body.appendChild(overlay);

            const logContainer = overlay.querySelector(".dev-logs");

            function addLog(msg, type) {
                const entry = document.createElement("div");
                entry.className = "dev-log-entry" + (type ? " dev-log-" + type : "");
                entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
                logContainer.appendChild(entry);
                overlay.scrollTop = overlay.scrollHeight;
            }

            if (showConsole) {
                const oldError = console.error;
                console.error = function(...args) {
                    addLog(args.join(" "), "error");
                    oldError.apply(console, args);
                };
                window.addEventListener("error", (e) => addLog(e.message, "error"));
            }

            if (showNetwork) {
                const oldFetch = window.fetch;
                window.fetch = function(...args) {
                    addLog(`FETCH: ${args[0]}`, "network");
                    return oldFetch.apply(window, args);
                };
                const oldOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url) {
                    addLog(`XHR: ${method} ${url}`, "network");
                    return oldOpen.apply(this, arguments);
                };
            }
        });
    }

    // Login Tracker
    if (localStorage.getItem("dev_logins") === "true" && localStorage.getItem("currentUser")) {
        const lastLogin = localStorage.getItem("dev_last_login_logged");
        const curUser = localStorage.getItem("currentUser");
        if (lastLogin !== curUser) {
            let logs = JSON.parse(localStorage.getItem("dev_login_history") || "[]");
            logs.unshift(`${new Date().toLocaleString()}: Logged in as @${curUser}`);
            localStorage.setItem("dev_login_history", JSON.stringify(logs.slice(0, 10)));
            localStorage.setItem("dev_last_login_logged", curUser);
        }
    }

    // Auto Refresh
    if (localStorage.getItem("dev_refresh") === "true") {
        setInterval(() => {
            if (document.hidden) return;
            if (typeof render === "function") {
                console.log("Dev: Auto-refreshing feed...");
                render(null, null, (typeof _currentPage !== "undefined" ? _currentPage : 0));
            } else if (typeof renderAlgo === "function") {
                console.log("Dev: Auto-refreshing algo feed...");
                renderAlgo();
            }
        }, 30000); // every 30s
    }
})();
