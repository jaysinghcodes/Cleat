# Detect this computer's LAN address for the phone.
[ -n "${CLEAT_LAN_LOADED:-}" ] && return 0
CLEAT_LAN_LOADED=1

cleat_lan_ip() {
  if [ -n "${CLEAT_LAN_IP:-}" ]; then
    printf '%s\n' "$CLEAT_LAN_IP"
    return 0
  fi

  local ip=""
  if [ "$(uname -s)" = "Darwin" ]; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    if [ -z "$ip" ]; then
      ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
    fi
    if [ -z "$ip" ]; then
      local iface=""
      iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
      if [ -n "$iface" ]; then
        ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      fi
    fi
  fi

  if [ -z "$ip" ] && command -v node >/dev/null 2>&1; then
    ip="$(
      node -e 'const dgram=require("dgram"); const s=dgram.createSocket("udp4"); const done=(addr)=>{try{s.close();}catch(e){} if(addr) process.stdout.write(addr);}; s.on("error",()=>done("")); s.connect(80,"1.1.1.1",()=>done(s.address().address));' 2>/dev/null || true
    )"
  fi

  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi

  if [ -z "$ip" ] || [ "$ip" = "127.0.0.1" ]; then
    echo "Could not detect a LAN address. The mobile Supabase URL will use 127.0.0.1." >&2
    echo "Fix: set CLEAT_LAN_IP to this computer's Wi-Fi address and run pnpm run setup again." >&2
    printf '%s\n' "127.0.0.1"
    return 0
  fi

  printf '%s\n' "$ip"
}
