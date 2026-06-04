import http.server
import socketserver
import urllib.request
import json
import threading
import time

PORT = 8080
API_URL = "https://menu.multicraft.online/v1/find-nearby-servers"
HEADERS = {
    "User-Agent": "MultiCraft/2.0.17 Windows (Windows/10.0.19041 x86_64)",
    "Content-Type": "application/json",
    "Accept": "*/*"
}

FAVORITE_SERVERS = {
    "QVZACNG5": "Parkour Cubicles [12+]"
}

SERVER_CACHE = []
cache_lock = threading.Lock()
FIREBASE_DB_URL = "https://area--12-default-rtdb.firebaseio.com"

def write_to_firebase(data):
    url = f"{FIREBASE_DB_URL}/servers.json"
    try:
        binary_data = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=binary_data, method="PUT")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                print("✅ Successfully updated server list in Firebase Realtime Database.")
    except Exception as e:
        print(f"❌ Failed to write to Firebase: {e}")

def fetch_live_metrics_loop():
    """Background polling thread that updates the local server status cache every 30 seconds."""
    payload = {"favorites": ",".join(FAVORITE_SERVERS.keys())}
    favorite_ids = set(FAVORITE_SERVERS.keys())
    
    print("🚀 MultiCraft Background Polling Engine Started.")
    while True:
        try:
            binary_payload = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(API_URL, data=binary_payload, headers=HEADERS, method="POST")
            
            with urllib.request.urlopen(req, timeout=10) as response:
                raw_json = response.read().decode('utf-8')
                parsed_data = json.loads(raw_json)
                
                all_discovered_servers = []
                found_favorites = set()
                
                # 1. Process favorites block (nested dict keyed by server ID)
                favorites_map = parsed_data.get("favorites", {})
                for s_id, s_data in favorites_map.items():
                    s_id_upper = s_id.upper()
                    if s_id_upper in favorite_ids and isinstance(s_data, dict):
                        found_favorites.add(s_id_upper)
                        desc = s_data.get("description", "").replace("\n", " ").strip()
                        all_discovered_servers.append({
                            "server_id": s_id_upper,
                            "online": s_data.get("online", True),
                            "is_favorite": True,
                            "name": s_data.get("server_name", FAVORITE_SERVERS[s_id_upper]),
                            "admin": s_data.get("admin_name", "Unknown"),
                            "player_val": int(s_data.get("connected_players", 0)),
                            "players": f"{s_data.get('connected_players', 0)}/{s_data.get('max_players', 100)}",
                            "description": desc if desc else "No room description provided.",
                            "pvp": s_data.get("pvp", True)
                        })

                # 2. Inject missing/offline favorites
                for s_id in favorite_ids:
                    if s_id not in found_favorites:
                        all_discovered_servers.append({
                            "server_id": s_id,
                            "online": False,
                            "is_favorite": True,
                            "name": FAVORITE_SERVERS[s_id],
                            "admin": "Unknown",
                            "player_val": 0,
                            "players": "0/100",
                            "description": "Server is currently sleeping or offline.",
                            "pvp": True
                        })

                # 3. Process nearby servers from the list
                nearby_list = parsed_data.get("nearby", [])
                for s_data in nearby_list:
                    if not isinstance(s_data, dict):
                        continue
                        
                    s_id = s_data.get("server_id", s_data.get("id", "")).upper()
                    if s_id in favorite_ids:
                        continue  # Skip, already handled in favorites
                        
                    desc = s_data.get("description", "").replace("\n", " ").strip()
                    all_discovered_servers.append({
                        "server_id": s_id if s_id else "UNKNOWN",
                        "online": s_data.get("online", True),
                        "is_favorite": False,
                        "name": s_data.get("server_name", s_data.get("name", "MultiCraft Server")),
                        "admin": s_data.get("admin_name", s_data.get("admin", "Unknown")),
                        "player_val": int(s_data.get("connected_players", s_data.get("clients", 0))),
                        "players": f"{s_data.get('connected_players', s_data.get('clients', 0))}/{s_data.get('max_players', s_data.get('clients_max', 50))}",
                        "description": desc if desc else "No room description provided.",
                        "pvp": s_data.get("pvp", True)
                    })

                # Sort: Favorites first, then online servers sorted by active players descending
                all_discovered_servers.sort(key=lambda x: (not x["is_favorite"], -x["player_val"]))

                # Commit to cache
                global SERVER_CACHE
                with cache_lock:
                    SERVER_CACHE = all_discovered_servers
                    
                print(f"[{time.strftime('%X')}] Synchronized Server List: {len(all_discovered_servers)} total servers.")
                write_to_firebase(all_discovered_servers)
                
        except Exception as e:
            print(f"Pipeline error fetching metrics: {e}")
            
        time.sleep(30)

class EmbeddedDashboardServer(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200, "ok")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/servers"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with cache_lock:
                json_string = json.dumps(SERVER_CACHE)
            self.wfile.write(json_string.encode('utf-8'))
        else:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy", "service": "MultiCraft Dashboard Backend"}).encode('utf-8'))

    def log_message(self, format, *args):
        # Silence native logging to avoid filling logs on Pella.app
        return

if __name__ == "__main__":
    api_thread = threading.Thread(target=fetch_live_metrics_loop, daemon=True)
    api_thread.start()
    
    print(f"Starting server on port {PORT}...")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), EmbeddedDashboardServer) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
