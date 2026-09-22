# start_all.py
import subprocess
import os
import sys
import time
import platform
import signal
from datetime import datetime

# ===== CONFIGURATION =====
# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # Go up one level to Rootcare
BACKEND_DIR = SCRIPT_DIR  # Since this script is in backend folder

def print_colored(text, color="green"):
    """Print colored text"""
    colors = {
        "green": "\033[92m",
        "yellow": "\033[93m",
        "red": "\033[91m",
        "cyan": "\033[96m",
        "blue": "\033[94m",
        "magenta": "\033[95m",
        "gray": "\033[90m",
        "reset": "\033[0m"
    }
    print(f"{colors.get(color, '')}{text}{colors['reset']}")

def print_header(text):
    """Print a section header"""
    print()
    print_colored("=" * 50, "cyan")
    print_colored(f" {text}", "cyan")
    print_colored("=" * 50, "cyan")
    print()

def print_success(text):
    print_colored(f"✅ {text}", "green")

def print_error(text):
    print_colored(f"❌ {text}", "red")

def print_info(text):
    print_colored(f"ℹ️ {text}", "blue")

def print_warning(text):
    print_colored(f"⚠️ {text}", "yellow")

# ===== CORE FUNCTIONS =====

def get_local_ip():
    """Get the local IP address using the existing script"""
    try:
        print_info("Running IP detection...")
        
        # The script is in the same folder (backend)
        get_ip_path = os.path.join(BACKEND_DIR, "get_ip.py")
        
        if not os.path.exists(get_ip_path):
            print_error(f"get_ip.py not found at: {get_ip_path}")
            return False
        
        result = subprocess.run(
            ["python", get_ip_path],
            cwd=BACKEND_DIR,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print_success("IP detected successfully!")
            print(result.stdout)
            return True
        else:
            print_error(f"IP detection failed: {result.stderr}")
            return False
    except Exception as e:
        print_error(f"Error detecting IP: {e}")
        return False

def check_flask_running(port=5000):
    """Check if Flask is already running"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', port))
    sock.close()
    return result == 0

def start_flask_server():
    """Start the Flask server in a new terminal"""
    print_info("Starting Flask AI Server...")
    
    if check_flask_running(5000):
        print_warning("Flask is already running on port 5000")
        return True
    
    try:
        if platform.system() == "Windows":
            # Windows: Open new CMD window
            subprocess.Popen(
                ["start", "cmd", "/k", f"cd /d {BACKEND_DIR} && echo Flask AI Server & echo ==================== & python app.py"],
                shell=True
            )
        elif platform.system() == "Darwin":
            # macOS: Open new Terminal
            subprocess.Popen([
                "osascript", "-e",
                f'tell application "Terminal" to do script "cd {BACKEND_DIR} && python3 app.py"'
            ])
        else:
            # Linux
            terminals = ["gnome-terminal", "xterm", "x-terminal-emulator"]
            for term in terminals:
                try:
                    subprocess.Popen([term, "--", "python3", "app.py"], cwd=BACKEND_DIR)
                    break
                except FileNotFoundError:
                    continue
            else:
                print_error("No terminal found! Please start Flask manually.")
                return False
        
        print_success("Flask server starting...")
        return True
        
    except Exception as e:
        print_error(f"Failed to start Flask: {e}")
        return False

def start_expo_server():
    """Start the Expo server in a new terminal"""
    print_info("Starting Expo server...")
    
    try:
        if platform.system() == "Windows":
            # Windows: Open new CMD window
            subprocess.Popen(
                ["start", "cmd", "/k", f"cd /d {PROJECT_ROOT} && echo Expo Server & echo ==================== & npx expo start"],
                shell=True
            )
        elif platform.system() == "Darwin":
            # macOS: Open new Terminal
            subprocess.Popen([
                "osascript", "-e",
                f'tell application "Terminal" to do script "cd {PROJECT_ROOT} && npx expo start"'
            ])
        else:
            # Linux
            terminals = ["gnome-terminal", "xterm", "x-terminal-emulator"]
            for term in terminals:
                try:
                    subprocess.Popen([term, "--", "npx", "expo", "start"], cwd=PROJECT_ROOT)
                    break
                except FileNotFoundError:
                    continue
            else:
                print_error("No terminal found! Please start Expo manually.")
                return False
        
        print_success("Expo server starting...")
        return True
        
    except Exception as e:
        print_error(f"Failed to start Expo: {e}")
        return False

def wait_for_server():
    """Wait for Flask server to become responsive"""
    print_info("Waiting for Flask to start...")
    time.sleep(3)

# ===== MAIN FUNCTION =====

def main():
    """Main entry point"""
    print_header("🚀 STARTING ROOTCARE SERVER")
    
    print(f"📁 Project Root: {PROJECT_ROOT}")
    print(f"📁 Backend Dir: {BACKEND_DIR}")
    print()
    
    # Step 1: Detect IP
    print_header("📡 Step 1: IP Detection")
    if not get_local_ip():
        print_error("Failed to detect IP address!")
        print_warning("Please check your network connection.")
        response = input("Continue anyway? (y/n): ").lower()
        if response != 'y':
            print_warning("Exiting...")
            return
    
    # Step 2: Start Flask
    print_header("🧠 Step 2: Starting Flask AI Server")
    if not start_flask_server():
        print_error("Failed to start Flask server!")
        input("Press Enter to exit...")
        return
    
    # Step 3: Wait for Flask
    print_header("⏳ Step 3: Waiting for Server")
    wait_for_server()
    
    # Step 4: Start Expo
    print_header("📱 Step 4: Starting Expo")
    if not start_expo_server():
        print_error("Failed to start Expo server!")
        input("Press Enter to exit...")
        return
    
    # Step 5: Done
    print_header("✅ ALL SERVERS STARTED!")
    print_colored("📡 Flask Server: http://localhost:5000", "cyan")
    print_colored("📱 Expo Server: http://localhost:8081", "cyan")
    print_colored("📊 Health Check: http://localhost:5000/health", "cyan")
    print()
    print_colored("🎯 To stop: Close the Flask and Expo windows", "yellow")
    print_colored("💡 Press Enter to exit this script", "gray")
    
    input("\nPress Enter to exit...")

# ===== COMMAND LINE ARGUMENTS =====

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_warning("\n\nShutting down...")
        sys.exit(0)