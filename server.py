import http.server
import socketserver
import webbrowser
import os
import sys

# Ensure UTF-8 output in Windows console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("==================================================")
        print(f" Sunday School App - Virgin Mary Church (El-Shamiya)")
        print("==================================================")
        print(f" Running on: {url}")
        print(" Press Ctrl+C to stop.")
        print("==================================================")
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"Could not open browser automatically: {e}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n Server stopped successfully.")

if __name__ == "__main__":
    run()
