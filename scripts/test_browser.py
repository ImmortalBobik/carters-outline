import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8095
Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
t = threading.Thread(target=httpd.serve_forever, daemon=True)
t.start()
time.sleep(0.5)

errors = []
console_logs = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Standard 1280x720 laptop viewport
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: errors.append(str(err)))

        page.goto(f'http://127.0.0.1:{PORT}/')
        page.wait_for_timeout(1000)

        title = page.title()
        print('Page title:', title)
        assert "Carter's Outline" in title

        # Verify zero vertical scrollbar / entire UI fits in single viewport
        scroll_height = page.evaluate("document.documentElement.scrollHeight")
        client_height = page.evaluate("document.documentElement.clientHeight")
        print(f'Viewport fit check: clientHeight={client_height}, scrollHeight={scroll_height}')
        assert scroll_height <= client_height, f"Page overflowed viewport! {scroll_height} > {client_height}"

        heads_len = page.evaluate("window.CARTER_HEADS ? window.CARTER_HEADS.length : 0")
        print('Loaded heads count:', heads_len)
        assert heads_len == 5

        print('Testing Spacebar hold to grow stick...')
        page.keyboard.down('Space')
        page.wait_for_timeout(1800)
        page.keyboard.up('Space')

        # Wait for wrap animation to complete (duration is 920ms)
        page.wait_for_timeout(1500)

        modal_visible = page.evaluate("!document.getElementById('resultModal').classList.contains('hidden')")
        print('Result modal visible:', modal_visible)
        assert modal_visible, "Modal should be visible after wrap completion"

        acc_text = page.inner_text('#resultAccuracy')
        tag_text = page.inner_text('#resultTag')
        points_text = page.inner_text('#resultPoints')
        print(f'Result: Accuracy={acc_text}, Tag={tag_text}, Points={points_text}')

        # Click result modal to reset
        page.click('#resultModal')
        page.wait_for_timeout(500)
        modal_hidden = page.evaluate("document.getElementById('resultModal').classList.contains('hidden')")
        print('Result modal dismissed:', modal_hidden)
        assert modal_hidden

        # Switch to face 3 (Curly Hair Studio)
        print('Testing face selector thumbnail click...')
        cards = page.query_selector_all('.face-thumb-card')
        assert len(cards) == 5
        cards[2].click()
        page.wait_for_timeout(400)
        curr_name = page.inner_text('#faceNameBadge')
        print('Current face name after click:', curr_name)
        assert 'Curly' in curr_name

        # Switch via hotkey '4'
        page.keyboard.press('4')
        page.wait_for_timeout(300)
        curr_name4 = page.inner_text('#faceNameBadge')
        print('Face after hotkey 4:', curr_name4)
        assert 'Trucker' in curr_name4

        # Take screenshot of clean gameplay on 1280x720 viewport
        page.screenshot(path='assets/game_verified.png')
        print('Saved assets/game_verified.png')

        browser.close()
finally:
    httpd.shutdown()

print('Console logs:', console_logs)
print('Errors:', errors)
assert len(errors) == 0, f'Browser encountered errors: {errors}'
print('>>> ALL BROWSER AUTOMATION TESTS PASSED 100%! <<<')
