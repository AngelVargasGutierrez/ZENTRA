# Servidor local de la tienda sin caché, para ver los cambios al instante.
import http.server, functools

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

http.server.test(HandlerClass=H, port=8080, bind="127.0.0.1")
