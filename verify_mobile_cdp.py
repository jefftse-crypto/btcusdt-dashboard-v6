import json
import subprocess
import time
import urllib.request
import urllib.parse
import sys

try:
    import websocket
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"websocket-client not available: {exc}"}, ensure_ascii=False))
    sys.exit(2)

PORT = 9223
URL = "http://127.0.0.1:3001/"

chrome = subprocess.Popen([
    "chromium",
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-address=127.0.0.1",
    f"--remote-debugging-port={PORT}",
    "--remote-allow-origins=*",
    "--window-size=390,844",
    "about:blank",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

try:
    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=0.2).read()
            break
        except Exception:
            time.sleep(0.1)
    else:
        raise RuntimeError("Chrome DevTools port did not become ready")

    tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=3).read().decode())
    tab = tabs[0]
    ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
    seq = 0

    def send(method, params=None):
        nonlocal_seq = None
        global seq
        seq += 1
        ws.send(json.dumps({"id": seq, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == seq:
                if "error" in msg:
                    raise RuntimeError(f"CDP {method} error: {msg['error']}")
                return msg.get("result", {})

    send("Runtime.enable")
    send("Page.enable")
    send("Emulation.setDeviceMetricsOverride", {
        "width": 390,
        "height": 844,
        "deviceScaleFactor": 2,
        "mobile": True,
    })
    send("Emulation.setUserAgentOverride", {
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    })
    send("Page.navigate", {"url": URL})
    time.sleep(8)

    js = r'''
    (async () => {
      const text = () => document.body.innerText;
      const navButtons = Array.from(document.querySelectorAll('button')).map((b) => ({
        text: (b.innerText || b.textContent || '').trim(),
        rect: (() => { const r = b.getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; })(),
        visible: (() => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; })(),
      })).filter(b => b.visible);
      const labels = navButtons.map(b => b.text).filter(Boolean);
      const pa = navButtons.find(b => b.text === 'PA');
      const chan = navButtons.find(b => b.text === '纏論');
      if (pa) pa.elementIndex = navButtons.indexOf(pa);
      if (chan) chan.elementIndex = navButtons.indexOf(chan);
      const clickByText = async (label) => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => ((b.innerText || b.textContent || '').trim() === label) && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0);
        if (!btn) return false;
        btn.click();
        await new Promise(r => setTimeout(r, 5000));
        return true;
      };
      const clickedPa = await clickByText('PA');
      const paText = text();
      const clickedChan = await clickByText('纏論');
      const chanText = text();
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        labels,
        hasBottomPa: !!pa && pa.rect.y > window.innerHeight - 140,
        hasBottomChan: !!chan && chan.rect.y > window.innerHeight - 140,
        paRect: pa ? pa.rect : null,
        chanRect: chan ? chan.rect : null,
        clickedPa,
        paContentVisible: /PA 多時間框架共識|Rayner Teo|多時間框架/.test(paText),
        clickedChan,
        chanContentVisible: /纏論分析|多時段纏論總結|趨勢一致性|操作建議/.test(chanText),
        paSnippet: paText.slice(0, 500),
        chanSnippet: chanText.slice(0, 500),
      };
    })()
    '''
    result = send("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
    value = result.get("result", {}).get("value")
    print(json.dumps({"ok": True, "result": value}, ensure_ascii=False, indent=2))
    ws.close()
finally:
    chrome.terminate()
    try:
        chrome.wait(timeout=3)
    except subprocess.TimeoutExpired:
        chrome.kill()
