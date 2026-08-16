#!/usr/bin/env bash
set -e

echo "=================================================="
echo "      Installing SlopiFY Tunnel Daemon Service     "
echo "=================================================="

INSTALL_DIR="/home/$USER/slopify-daemon"
mkdir -p "$INSTALL_DIR"

# Copy python script
cp "$(dirname "$0")/slopify-tunnel-daemon.py" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/slopify-tunnel-daemon.py"

# Write systemd service file
sudo tee /etc/systemd/system/slopify-tunnel.service > /dev/null <<EOF
[Unit]
Description=SlopiFY Cloudflare Storage Tunnel & Firestore Sync Daemon
After=network.target minio.service
Wants=minio.service

[Service]
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/slopify-tunnel-daemon.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now slopify-tunnel.service

echo ""
echo "✅ SlopiFY Storage Tunnel Daemon installed and started successfully!"
echo "Check live logs with: sudo journalctl -u slopify-tunnel -f"
